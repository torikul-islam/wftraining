// original source: https://github.com/pilovm/multithreaded-uploader/blob/master/frontend/uploader.js
export class S3Uploader {
  private chunkSize: number;
  private threadsQuantity: number;
  private uploadedSize: number;
  private progressCache: any;
  private baseUrl: string;
  private adminBaseUrl: string;
  private classId: string;
  private customerId: string;
  private exerciseId: string;
  private aborted: boolean;
  private activeConnections: any;
  private parts: any;
  private uploadedParts: any;
  private fileId: any;
  private fileKey: any;
  private onProgressFn: any;
  private onErrorFn: any;
  private file: any;
  constructor(options: any) {
    // this must be bigger than or equal to 5MB,
    // otherwise AWS will respond with:
    // "Your proposed upload is smaller than the minimum allowed size"
    this.chunkSize = options.chunkSize || 1024 * 1024 * 5
    // number of parallel uploads
    this.threadsQuantity = Math.min(options.threadsQuantity || 5, 15)
    this.baseUrl = options.baseUrl;
    this.adminBaseUrl = options.adminBaseUrl;
    this.aborted = false
    this.uploadedSize = 0
    this.progressCache = {}
    this.activeConnections = {}
    this.parts = []
    this.uploadedParts = [];
    this.fileId = null;
    this.fileKey = null;
    this.onProgressFn = () => {}
    this.onErrorFn = () => {}
    this.file = options.file;
    this.classId = options.classId;
    this.customerId = options.customerId;
    this.exerciseId = options.exerciseId;
    console.log("baseUrl:"+this.baseUrl);
  }

  // starting the multipart upload request
  start() {
    this.initialize()
  }

  async initialize() {
    try {
        const initializeReponse = await fetch(
        `${this.baseUrl}initializeMultipartUpload?classId=${this.classId}&customerId=${this.customerId}&exerciseId=${this.exerciseId}`, {
          method: 'POST',
        });

        const json = await initializeReponse.json();
        if (json.error) {
            throw new Error(`Server error: ${json.error}`);
        }
        console.log("initializeResponse:"+JSON.stringify(json));
        this.fileId = json.fileId;
        this.fileKey = json.fileKey;

        // retrieving the pre-signed URLs
        const numberOfparts = Math.ceil(this.file.size / this.chunkSize)
        console.log("numberOfparts: "+this.file.size);
        const urlsResponse = await fetch(
            `${this.baseUrl}getMultipartPreSignedUrls?fileKey=${encodeURIComponent(this.fileKey)}&fileId=${this.fileId}&parts=${numberOfparts}`, {
              method: 'POST',
            });
        const urlsJson = await urlsResponse.json();
        console.log("multipartpresignedurlsResponse:"+JSON.stringify(urlsJson));

        if (urlsJson.error) {
            throw new Error(`Server error: ${urlsJson.error}`);
        }
        const newParts = urlsJson.parts;
        this.parts.push(...newParts)
        this.sendNext()
    } catch (error) {
      await this.complete(error)
    }
  }

  sendNext(): void {
    const activeConnections = Object.keys(this.activeConnections).length

    if (activeConnections >= this.threadsQuantity) {
      return
    }

    if (!this.parts.length) {
      if (!activeConnections) {
        this.complete("")
      }

      return
    }

    const part = this.parts.pop()
    if (this.file && part) {
      const sentSize = (part.PartNumber - 1) * this.chunkSize
      const chunk = this.file.slice(sentSize, sentSize + this.chunkSize)

      const sendChunkStarted = () => {
        this.sendNext()
      }

      this.sendChunk(chunk, part, sendChunkStarted)
        .then(() => {
          this.sendNext()
        })
        .catch((error) => {
          this.parts.push(part)

          this.complete(error)
        })
    }
  }

  // terminating the multipart upload request on success or failure
  async complete(error: string) {
    if (error && !this.aborted) {
      this.onErrorFn(error)
      return
    }

    if (error) {
      this.onErrorFn(error)
      return
    }

    try {
      await this.sendCompleteRequest()
    } catch (error) {
      this.onErrorFn(error)
    }
  }

  // finalizing the multipart upload request on success by calling
  // the finalization API
  async sendCompleteRequest() {
    if (this.fileId && this.fileKey) {
        const body = JSON.stringify({
            fileId: this.fileId,
            fileKey: this.fileKey,
            parts: this.uploadedParts
          });
        console.log('----finalize----');
        console.log(body);
        const finalizeReponse = await fetch(
        `${this.baseUrl}finalizeMultipartUpload`, {
          method: 'POST',
          body
        });
        
        const json = await finalizeReponse.json();
        if (json.error) {
            throw new Error(`Server error: ${json.error}`);
        } else {
          try {
            const response = await fetch(
              this.adminBaseUrl + `Home/SaveCustomerWorkoutRecording?ClassScheduleId=${this.classId}&CustomerId=${this.customerId}&ExerciseId=${this.exerciseId}&VideoName=${encodeURIComponent(this.fileKey)}`,
              {
                method: 'POST',
                mode: 'cors'
              }
            );
            const json = await response.json();
            if (json.Status == true) {
              console.log('Updating recording db successed.');
            } else {
              console.log('Updating recording db failed.');
            }
          } catch (err) {
            throw new Error(`Updating db error: ${err}`);
          }      
        }
    }
  }

  sendChunk(chunk: any, part: any, sendChunkStarted: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.upload(chunk, part, sendChunkStarted)
        .then((status) => {
          if (status !== 200) {
            reject(new Error("Failed chunk upload"))
            return
          }
          resolve()
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  // calculating the current progress of the multipart upload request
  handleProgress(part:any, event:any) {
    if (this.file) {
      if (event.type === "progress" || event.type === "error" || event.type === "abort") {
        this.progressCache[part] = event.loaded
      }

      if (event.type === "uploaded") {
        this.uploadedSize += this.progressCache[part] || 0
        delete this.progressCache[part]
      }

      const inProgress = Object.keys(this.progressCache)
        .map(Number)
        .reduce((memo, id) => (memo += this.progressCache[id]), 0)

      const sent = Math.min(this.uploadedSize + inProgress, this.file.size)

      const total = this.file.size

      const percentage = Math.round((sent / total) * 100)

      this.onProgressFn({
        sent: sent,
        total: total,
        percentage: percentage,
      })
    }
  }

  // uploading a part through its pre-signed URL
  upload(file: any, part: any, sendChunkStarted: any): Promise<number> {
    // uploading each part with its pre-signed URL
    return new Promise((resolve, reject) => {
      if (this.fileId && this.fileKey) {
        // - 1 because PartNumber is an index starting from 1 and not 0
        const xhr = (this.activeConnections[part.PartNumber - 1] = new XMLHttpRequest())

        sendChunkStarted()

        const progressListener = this.handleProgress.bind(this, part.PartNumber - 1)

        xhr.upload.addEventListener("progress", progressListener)

        xhr.addEventListener("error", progressListener)
        xhr.addEventListener("abort", progressListener)
        xhr.addEventListener("loadend", progressListener)

        xhr.open("PUT", part.signedUrl)

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4 && xhr.status === 200) {
            // retrieving the ETag parameter from the HTTP headers
            const ETag = xhr.getResponseHeader("ETag")

            if (ETag) {
              const uploadedPart = {
                PartNumber: part.PartNumber,
                // removing the " enclosing carachters from
                // the raw ETag
                ETag: ETag.replace('"', ""),
              }

              this.uploadedParts.push(uploadedPart)

              resolve(xhr.status)
              delete this.activeConnections[part.PartNumber - 1]
            }
          }
        }

        xhr.onerror = (error) => {
          reject(error)
          delete this.activeConnections[part.PartNumber - 1]
        }

        xhr.onabort = () => {
          reject(new Error("Upload canceled by user"))
          delete this.activeConnections[part.PartNumber - 1]
        }

        xhr.send(file)
      }
    })
  }

  onProgress(onProgress: any) {
    this.onProgressFn = onProgress
    return this
  }

  onError(onError: any) {
    this.onErrorFn = onError
    return this
  }

  abort() {
    Object.keys(this.activeConnections)
      .map(Number)
      .forEach((id) => {
        this.activeConnections[id].abort()
      })

    this.aborted = true
  }
}
