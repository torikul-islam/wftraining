// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');
const compression = require('compression');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { v4: uuidv4 } = require('uuid');
const _ = require("lodash"); 

// Store created meetings in a map so attendees can join by meeting title
const meetingTable = {};


// Load the contents of the web application to be used as the index page
const botPage = fs.readFileSync(`dist/bot.html`);
const workoutPage = fs.readFileSync(`dist/workout.html`);

// Create ans AWS SDK Chime object. Region 'us-east-1' is currently required.
// Use the MediaRegion property below in CreateMeeting to select the region
// the meeting is hosted in.
const chime = new AWS.Chime({ region: 'us-east-1' });

// Set the AWS SDK Chime endpoint. The global endpoint is https://service.chime.aws.amazon.com.
chime.endpoint = new AWS.Endpoint(process.env.ENDPOINT || 'https://service.chime.aws.amazon.com');

const s3Endpoint = new AWS.Endpoint("https://s3.us-west-2.amazonaws.com")

const s3Credentials = new AWS.Credentials({
  accessKeyId: "AKIAWCJB66UWSJEQ6UPR",
  secretAccessKey: "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"
})

const s3 = new AWS.S3({
  endpoint: s3Endpoint,
  credentials: s3Credentials,
})

const RECORDING_BUCKET_NAME = "wf-dev-video";
//const RECORDING_BUCKET_NAME = "wf-prod-video";

function serve(host = '127.0.0.1:8080') {
  // Start an HTTP server to serve the index page and handle meeting actions
  http.createServer({}, async (request, response) => {
    log(`${request.method} ${request.url} BEGIN`);
    try {
      // Enable HTTP compression
      compression({})(request, response, () => {});
      const requestUrl = url.parse(request.url, true);
      if (request.method === 'GET' && requestUrl.pathname === '/') {
        // Return the contents of the index page
        respond(response, 200, 'text/html', workoutPage);
      } else if (request.method === 'GET' && requestUrl.pathname === '/bot') {
        // Return the contents of the bot page
        respond(response, 200, 'text/html', botPage);  
      } else if (process.env.DEBUG && request.method === 'POST' && requestUrl.pathname === '/join') {
        // For internal debugging - ignore this.
        respond(response, 201, 'application/json', JSON.stringify(require('./debug.js').debug(requestUrl.query), null, 2));
      } else if (request.method === 'POST' && requestUrl.pathname === '/join') {
        if (!requestUrl.query.title || !requestUrl.query.name || !requestUrl.query.region) {
          throw new Error('Need parameters: title, name, region');
        }

        // Look up the meeting by its title. If it does not exist, create the meeting.
        if (!meetingTable[requestUrl.query.title]) {
          meetingTable[requestUrl.query.title] = await chime.createMeeting({
            // Use a UUID for the client request token to ensure that any request retries
            // do not create multiple meetings.
            ClientRequestToken: uuidv4(),
            // Specify the media region (where the meeting is hosted).
            // In this case, we use the region selected by the user.
            MediaRegion: requestUrl.query.region,
            // Any meeting ID you wish to associate with the meeting.
            // For simplicity here, we use the meeting title.
            ExternalMeetingId: requestUrl.query.title.substring(0, 64),
          }).promise();
        }

        // Fetch the meeting info
        const meeting = meetingTable[requestUrl.query.title];

        const listAttendees = (await chime.listAttendees({
          // The meeting ID of the created meeting to add the attendee to
          MeetingId: meeting.Meeting.MeetingId,
        }).promise());
        let bFirst = true;
        for ( let i = 0; i < listAttendees.Attendees.length; i++){
          if ( listAttendees.Attendees[i].ExternalUserId.includes("Meeting Bot") )
            continue;
          bFirst = false;
          break;
        }
      
        // Create new attendee for the meeting
        const attendee = await chime.createAttendee({
          // The meeting ID of the created meeting to add the attendee to
          MeetingId: meeting.Meeting.MeetingId,

          // Any user ID you wish to associate with the attendeee.
          // For simplicity here, we use a random id for uniqueness
          // combined with the name the user provided, which can later
          // be used to help build the roster.
//          ExternalUserId: `${uuidv4().substring(0, 8)}#${requestUrl.query.name}`.substring(0, 64),
          ExternalUserId: `${requestUrl.query.name}#${requestUrl.query.role}#${requestUrl.query.customerId}#${uuidv4().substring(0, 8)}`.substring(0, 64),
        }).promise()

        // Return the meeting and attendee responses. The client will use these
        // to join the meeting.
        respond(response, 201, 'application/json', JSON.stringify({
          JoinInfo: {
            Meeting: meeting,
            Attendee: attendee,
            IsFirst: bFirst,
          },
        }, null, 2));
      } else if (request.method === 'POST' && requestUrl.pathname === '/end') {
        // End the meeting. All attendee connections will hang up.
        await chime.deleteMeeting({
          MeetingId: meetingTable[requestUrl.query.title].Meeting.MeetingId,
        }).promise();
        respond(response, 200, 'application/json', JSON.stringify({}));
      } else if (request.method === 'POST' && requestUrl.pathname === '/initializeMultipartUpload') {
        const query = requestUrl.query;
        if (!query.customerId || !query.classId || !query.exerciseId) {
          return respond(response,400, 'application/json', JSON.stringify({error: 'Need parameters: classId, customerId, exerciseId'}));
        }
        const key = `CustomerWorkoutRecording/${encodeURIComponent(query.classId)}/${encodeURIComponent(query.customerId)}/${query.exerciseId}.webm`;
        const multipartParams = {
          Bucket: RECORDING_BUCKET_NAME,
          Key: key, 
          ACL: "public-read", 
        }
        try{
          const multipartUpload = await s3.createMultipartUpload(multipartParams).promise(); 
          console.log("----multipartUpload---");
          console.log(multipartUpload);            
          return respond(response, 200, 'application/json', JSON.stringify({ fileId: multipartUpload.UploadId, fileKey: multipartUpload.Key }));  
        } catch( err ){
          return respond(response, 400, 'application/json', JSON.stringify({error: err}));
        }
      } else if (request.method === 'POST' && requestUrl.pathname === '/getMultipartPreSignedUrls') {
        const query = requestUrl.query;
        if (!query.fileKey || !query.fileId || !query.parts ) {
          return respond(response, 400, 'application/json', JSON.stringify({error: 'Need parameters: fileKey, fileId, parts'}));
        }
      
        const multipartParams = {
          Bucket: RECORDING_BUCKET_NAME,
          Key: query.fileKey,
          UploadId: query.fileId,
        }
        try{
          const promises = []
          for (let index = 0; index < query.parts; index++) {
            promises.push(
              s3.getSignedUrlPromise("uploadPart", {
              ...multipartParams,
              PartNumber: index + 1,
              }),
            )
          }
          const signedUrls = await Promise.all(promises)
          // assign to each URL the index of the part to which it corresponds
          const partSignedUrlList = signedUrls.map((signedUrl, index) => {
            return {
            signedUrl: signedUrl,
            PartNumber: index + 1,
            }
          });
          console.log(partSignedUrlList);
          return respond(response, 200, 'application/json', JSON.stringify({ parts: partSignedUrlList}));
        } catch( err ){
          console.log(err);
          return respond(response, 400, 'application/json', JSON.stringify({error: err}));
        }      
      } else if (request.method === 'POST' && requestUrl.pathname === '/finalizeMultipartUpload') {
        let body = [];
        request.on('data', (chunk) => {
          body.push(chunk);
        }).on('end', async () => {
          body = Buffer.concat(body).toString();
          //response.end(body);
          console.log('----finalize-----');
          console.log(body);
          const query = JSON.parse(body);
          if (!query.fileKey || !query.fileId || !query.parts) {
            return respond(response, 400, 'application/json', JSON.stringify({error: 'Need parameters: fileKey, fileId, parts'}));
          }
          const multipartParams = {
            Bucket: RECORDING_BUCKET_NAME,
            Key: query.fileKey,
            UploadId: query.fileId,
            MultipartUpload: {
              // Parts: query.parts
             Parts: _.orderBy(query.parts, ["PartNumber"], ["asc"])
            }
          }
          try{
            const completeMultipartUploadOutput  = await s3.completeMultipartUpload(multipartParams).promise();
            return respond(response, 200, 'application/json', JSON.stringify({ objectUrl: completeMultipartUploadOutput }));
          } catch( err ){
            console.log(err);
            return respond(response, 400, 'application/json', JSON.stringify({error: err}));
          }  
        });
    } else if (request.method === 'GET' && requestUrl.pathname === '/fetch_credentials') {
        const awsCredentials = {
          accessKeyId: AWS.config.credentials.accessKeyId,
          secretAccessKey: AWS.config.credentials.secretAccessKey,
          sessionToken: AWS.config.credentials.sessionToken,
        };
        respond(response, 200, 'application/json', JSON.stringify(awsCredentials), true);
      } else {
        respond(response, 404, 'text/html', '404 Not Found');
      }
    } catch (err) {
      respond(response, 400, 'application/json', JSON.stringify({ error: err.message }, null, 2));
    }
    log(`${request.method} ${request.url} END`);
  }).listen(host.split(':')[1], host.split(':')[0], () => {
    log(`server running at http://${host}/`);
  });
}

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
};

function respond(response, statusCode, contentType, body, skipLogging = false) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.end(body);
  if (contentType === 'application/json' && !skipLogging) {
    log(body);
  }
}

module.exports = { serve };