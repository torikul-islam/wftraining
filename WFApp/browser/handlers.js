// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('./aws-sdk');
const fs = require('fs');
const { v4: uuidv4 } = require('./uuid');
const { metricScope } = require('./aws-embedded-metrics');
const _ = require("./lodash");

//########handling bot begin#######
var ecs = new AWS.ECS();

// Reading environment variables
const ecsClusterArn = process.env.ecsClusterArn;
const ecsTaskDefinationArn = process.env.ecsTaskDefinationArn;
const ecsContainerName = process.env.ecsContainerName;
const botArtifactsBucket = process.env.botArtifactsBucket;
const RECORDING_BUCKET_NAME = process.env.RecordingBucket;

let responseBody = {
  message: '',
  input: ''
};

let responseData = {
  statusCode: 200,
  headers: {},
  body: ''
};

exports.botHandler = function(event, context, callback) {
  let meetingURL = "";
  let taskId = "";
  let botAction = "";
  
  console.log(event);

  responseBody.input = event;
  if(event.queryStringParameters && event.queryStringParameters.botAction) {
      console.log("Bot action: " + event.queryStringParameters.botAction);
      botAction = event.queryStringParameters.botAction;
  }
  
  switch(botAction.toLowerCase()) {
      case 'start':
          if(event.queryStringParameters && event.queryStringParameters.meetingURL) {
              console.log("Meeting URL: " + event.queryStringParameters.meetingURL);
              meetingURL = decodeURIComponent(event.queryStringParameters.meetingURL);
              return startBot(event, context, callback, meetingURL);
          } else {
              responseBody = {
                  message: "Missing parameter: meetingURL",
                  input: event
              };
              responseData = {
                  statusCode: 400,
                  headers: {},
                  body: JSON.stringify(responseBody, null, ' ')
              };
              context.succeed(responseData);
          }
      case 'stop':
          if(event.queryStringParameters && event.queryStringParameters.taskId) {
              console.log("ECS task ID: " + event.queryStringParameters.taskId);
              taskId = event.queryStringParameters.taskId;
              return stopBot(event, context, taskId);
          } else {
              responseBody = {
                  message: "Missing parameter: taskId",
                  input: event
              };
              responseData = {
                  statusCode: 400,
                  headers: {},
                  body: JSON.stringify(responseBody, null, ' ')
              };
              context.succeed(responseData);
          }
      default:
          responseBody = {
              message: "Invalid parameter: botAction. Valid values 'start' & 'stop'",
              input: event
          };
          responseData = {
              statusCode: 400,
              headers: {},
              body: JSON.stringify(responseBody)
          };
  }
  
  console.log("response: " + JSON.stringify(responseData));
  callback(null, responseData);
};

function startBot(event, context, callback, meetingUrl) {
  let ecsRunTaskParams = {
      cluster: ecsClusterArn,
      launchType: "EC2",
      count: 1,
      overrides: {
          containerOverrides: [ 
               { 
                  environment: [ 
                      { 
                          name: "MEETING_URL",
                          value: meetingUrl
                      },
                      {
                          name: "BOT_ARTIFACTS_BUCKET",
                          value: botArtifactsBucket
                      }
                ],
                  name: ecsContainerName
              }
          ],
      },
      placementConstraints: [{
          type: "distinctInstance"
      }],
      taskDefinition: ecsTaskDefinationArn
  };
  
  ecs.runTask(ecsRunTaskParams, function(err, data) {
      if (err) {
          console.log(err);   // an error occurred
          responseData.statusCode = err.statusCode;
          responseData.body = JSON.stringify(err, null, ' ');
          context.succeed(responseData);
      }
      else {
          console.log(data);  // successful response
          responseData.statusCode = 200;
          responseData.body = JSON.stringify((data.tasks.length && data.tasks[0].taskArn) ? data.tasks[0].taskArn : data, null, ' ');
          context.succeed(responseData);
      }
  });
}

function stopBot(event, context, taskId) {
  let ecsStopTaskParam = {
      cluster: ecsClusterArn,
      task: taskId
  };
  
  ecs.stopTask(ecsStopTaskParam, function(err, data) {
      if (err) {
          console.log(err);   // an error occurred
          responseData.statusCode = err.statusCode;
          responseData.body = JSON.stringify(err, null, ' ');
          context.succeed(responseData);
      }
      else {
          console.log(data);  // successful response
          responseData.statusCode = 200;
          responseBody = data;
          responseData.body = JSON.stringify(data, null, ' ');
          console.log("Stop task succeeded.", responseData);
          context.succeed(responseData);
      }
  });
}
//######handling bot end###


// Store meetings in a DynamoDB table so attendees can join by meeting title
const ddb = new AWS.DynamoDB();

// Create an AWS SDK Chime object. Region 'us-east-1' is currently required.
// Use the MediaRegion property below in CreateMeeting to select the region
// the meeting is hosted in.
const chime = new AWS.Chime({ region: 'us-east-1' });

// Set the AWS SDK Chime endpoint. The global endpoint is https://service.chime.aws.amazon.com.
chime.endpoint = new AWS.Endpoint(process.env.CHIME_ENDPOINT);

const s3Endpoint = new AWS.Endpoint("https://s3.us-west-2.amazonaws.com")

const s3Credentials = new AWS.Credentials({
  accessKeyId: "AKIAWCJB66UWSJEQ6UPR",
  secretAccessKey: "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"
})

const s3 = new AWS.S3({
  endpoint: s3Endpoint,
  credentials: s3Credentials,
})

// Read resource names from the environment
const {
  MEETINGS_TABLE_NAME,
  BROWSER_LOG_GROUP_NAME,
  BROWSER_MEETING_EVENT_LOG_GROUP_NAME,
  SQS_QUEUE_ARN,
  USE_EVENT_BRIDGE
} = process.env;
exports.initializeMultipartUpload = async (event, context, callback) => {
  const query = event.queryStringParameters;
  if (!query.customerId || !query.classId || !query.exerciseId) {
    return response(400, 'application/json', JSON.stringify({error: 'Need parameters: classId, customerId, exerciseId'}));
  }
  const key = `CustomerWorkoutRecording/${encodeURIComponent(query.classId)}/${encodeURIComponent(query.customerId)}/${query.exerciseId}.webm`;
  const multipartParams = {
    Bucket: RECORDING_BUCKET_NAME,
    Key: key, 
    ACL: "public-read", 
  }
  try{
    const multipartUpload = await s3.createMultipartUpload(multipartParams).promise(); 
      
    return response(200, 'application/json', JSON.stringify({ fileId: multipartUpload.UploadId, fileKey: multipartUpload.Key }));  
  } catch( err ){
    console.log(err);
    return response(400, 'application/json', JSON.stringify({error: err}));
  }
};
exports.getMultipartPreSignedUrls = async ( event, context, callback) => {
  const query = event.queryStringParameters;
  if (!query.fileKey || !query.fileId || !query.parts ) {
    return response(400, 'application/json', JSON.stringify({error: 'Need parameters: fileKey, fileId, parts'}));
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
    return response(200, 'application/json', JSON.stringify({ parts: partSignedUrlList}));
  } catch( err ){
    console.log(err);
    return response(400, 'application/json', JSON.stringify({error: err}));
  }
}
exports.finalizeMultipartUpload = async (event, context, callback) => {
  const query = JSON.parse(event.body);
  if (!query.fileKey || !query.fileId || !query.parts) {
    return response(400, 'application/json', JSON.stringify({error: 'Need parameters: fileKey, fileId, parts'}));
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
    return response(200, 'application/json', JSON.stringify({ objectUrl: completeMultipartUploadOutput }));
  } catch( err ){
    console.log(err);
    return response(400, 'application/json', JSON.stringify({error: err}));
  }
}
exports.indexBot = async (event, context, callback) => {
  // Return the contents of the index V2 page
  return response(200, 'text/html', fs.readFileSync('./indexBot.html', {encoding: 'utf8'}));
};
exports.indexWorkout = async (event, context, callback) => {
  // Return the contents of the workout page
  return response(200, 'text/html', fs.readFileSync('./indexWorkout.html', {encoding: 'utf8'}));
};

exports.join = async(event, context) => {
  const query = event.queryStringParameters;
  if (!query.title || !query.name || !query.region) {
    return response(400, 'application/json', JSON.stringify({error: 'Need parameters: title, name, region'}));
  }

  // Look up the meeting by its title. If it does not exist, create the meeting.
  let meeting = await getMeeting(query.title);
  if (!meeting) {
    const request = {
      // Use a UUID for the client request token to ensure that any request retries
      // do not create multiple meetings.
      ClientRequestToken: uuidv4(),

      // Specify the media region (where the meeting is hosted).
      // In this case, we use the region selected by the user.
      MediaRegion: query.region,

      // Set up SQS notifications if being used
      NotificationsConfiguration: USE_EVENT_BRIDGE === 'false' ? { SqsQueueArn: SQS_QUEUE_ARN } : {},

      // Any meeting ID you wish to associate with the meeting.
      // For simplicity here, we use the meeting title.
      ExternalMeetingId: query.title.substring(0, 64),

      // Tags associated with the meeting. They can be used in cost allocation console
      Tags: [
        { Key: 'Department', Value: 'RND'}
      ]
    };
    console.info('Creating new meeting: ' + JSON.stringify(request));
    meeting = await chime.createMeeting(request).promise();

    // Store the meeting in the table using the meeting title as the key.
    await putMeeting(query.title, meeting);
  }

  const listAttendees = (await chime.listAttendees({
    // The meeting ID of the created meeting to add the attendee to
    MeetingId: meeting.Meeting.MeetingId,
  }).promise());
  let bFirst = true;
  for ( i = 0; i < listAttendees.Attendees.length; i++){
    if ( listAttendees.Attendees[i].ExternalUserId.includes("Meeting Bot") )
      continue;
    bFirst = false;
    break;
  }

  // Create new attendee for the meeting
  console.info('Adding new attendee');
  const attendee = (await chime.createAttendee({
    // The meeting ID of the created meeting to add the attendee to
    MeetingId: meeting.Meeting.MeetingId,

    // Any user ID you wish to associate with the attendeee.
    // For simplicity here, we use a random UUID for uniqueness
    // combined with the name the user provided, which can later
    // be used to help build the roster.
    //ExternalUserId: `${uuidv4().substring(0, 8)}#${query.name}`.substring(0, 64),
    ExternalUserId: `${query.name}#${query.role}#${query.customerId}#${uuidv4().substring(0, 8)}`.substring(0, 64),
  }).promise());

  // Return the meeting and attendee responses. The client will use these
  // to join the meeting.
  return response(200, 'application/json', JSON.stringify({
    JoinInfo: {
      Meeting: meeting,
      Attendee: attendee,
      IsFirst: bFirst,
    },
  }, null, 2));
};

exports.end = async (event, context) => {
  // Fetch the meeting by title
  const meeting = await getMeeting(event.queryStringParameters.title);

  // End the meeting. All attendee connections will hang up.
  await chime.deleteMeeting({ MeetingId: meeting.Meeting.MeetingId }).promise();
  return response(200, 'application/json', JSON.stringify({}));
};

exports.fetch_credentials = async (event, context) => {
  const awsCredentials = {
    accessKeyId: AWS.config.credentials.accessKeyId,
    secretAccessKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
  };

  return response(200, 'application/json', JSON.stringify(awsCredentials));
};

exports.logs = async (event, context) => {
  return putLogEvents(event, BROWSER_LOG_GROUP_NAME, (logs, meetingId, attendeeId) => {
    const logEvents = [];
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const timestamp = new Date(log.timestampMs).toISOString();
      const message = `${timestamp} [${log.sequenceNumber}] [${log.logLevel}] [meeting: ${meetingId}] [attendee: ${attendeeId}]: ${log.message}`;
      logEvents.push({
        message: log.message,
        timestamp: log.timestampMs
      });
    }
    return logEvents;
  });
};

exports.log_meeting_event = async (event, context) => {
  return putLogEvents(event, BROWSER_MEETING_EVENT_LOG_GROUP_NAME, (logs, meetingId, attendeeId) => {
    const logEvents = [];
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // log.message must be a JSON string. CloudWatch Logs Insights will represent
      // nested JSON fields using the dot notation, e.g. attributes.sdkVersion
      logEvents.push({
        message: log.message,
        timestamp: log.timestampMs
      });
      addSignalMetricsToCloudWatch(log.message, meetingId, attendeeId);
    }
    return logEvents;
  });
};

// Called when SQS receives records of meeting events and logs out those records
exports.sqs_handler = async (event, context, callback) => {
  console.log(event.Records);
  return {};
}

// Called when EventBridge receives a meeting event and logs out the event
exports.event_bridge_handler = async (event, context, callback) => {
  console.log(event);
  return {};
}

exports.create_log_stream = async event => {
  return createLogStream(event, BROWSER_LOG_GROUP_NAME);
}

exports.create_browser_event_log_stream = async event => {
  return createLogStream(event, BROWSER_MEETING_EVENT_LOG_GROUP_NAME);
}

// === Helpers ===

// Retrieves the meeting from the table by the meeting title
async function getMeeting(title) {
  const result = await ddb.getItem({
    TableName: MEETINGS_TABLE_NAME,
    Key: {
      'Title': {
        S: title
      },
    },
  }).promise();
  return result.Item ? JSON.parse(result.Item.Data.S) : null;
}

// Stores the meeting in the table using the meeting title as the key
async function putMeeting(title, meeting) {
  await ddb.putItem({
    TableName: MEETINGS_TABLE_NAME,
    Item: {
      'Title': { S: title },
      'Data': { S: JSON.stringify(meeting) },
      'TTL': {
        N: `${Math.floor(Date.now() / 1000) + 60 * 60 * 24}` // clean up meeting record one day from now
      }
    }
  }).promise();
}

async function putLogEvents(event, logGroupName, createLogEvents) {
  const body = JSON.parse(event.body);
  if (!body.logs || !body.meetingId || !body.attendeeId || !body.appName) {
    return response(400, 'application/json', JSON.stringify({
      error: 'Required properties: logs, meetingId, attendeeId, appName'
    }));
  } else if (!body.logs.length) {
    return response(200, 'application/json', JSON.stringify({}));
  }

  const cloudWatchClient = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });
  const putLogEventsInput = {
    logGroupName,
    logStreamName: createLogStreamName(body.meetingId, body.attendeeId),
    logEvents: createLogEvents(body.logs, body.meetingId, body.attendeeId)
  };
  const uploadSequenceToken = await ensureLogStream(cloudWatchClient, logGroupName, putLogEventsInput.logStreamName);
  if (uploadSequenceToken) {
    putLogEventsInput.sequenceToken = uploadSequenceToken;
  }

  try {
    await cloudWatchClient.putLogEvents(putLogEventsInput).promise();
  } catch (error) {
    const errorMessage = `Failed to put CloudWatch log events with error ${error} and params ${JSON.stringify(putLogEventsInput)}`;
    if (error.code === 'InvalidSequenceTokenException' || error.code === 'DataAlreadyAcceptedException') {
      console.warn(errorMessage);
    } else {
      console.error(errorMessage);
    }
  }

  return response(200, 'application/json', JSON.stringify({}));
}

// Creates log stream if necessary and returns the current sequence token
async function ensureLogStream(cloudWatchClient, logGroupName, logStreamName) {
  const logStreamsResult = await cloudWatchClient.describeLogStreams({
    logGroupName: logGroupName,
    logStreamNamePrefix: logStreamName,
  }).promise();
  const foundStream = logStreamsResult.logStreams.find(logStream => logStream.logStreamName === logStreamName);
  if (foundStream) {
    return foundStream.uploadSequenceToken;
  }
  await cloudWatchClient.createLogStream({
    logGroupName: logGroupName,
    logStreamName: logStreamName,
  }).promise();
  return null;
}

async function createLogStream(event, logGroupName) {
  const body = JSON.parse(event.body);
  if (!body.meetingId || !body.attendeeId) {
    return response(400, 'application/json', JSON.stringify({
      error: 'Required properties: meetingId, attendeeId'
    }));
  }
  const cloudWatchClient = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });
  await cloudWatchClient.createLogStream({
    logGroupName,
    logStreamName: createLogStreamName(body.meetingId, body.attendeeId)
  }).promise();
  return response(200, 'application/json', JSON.stringify({}));
}

function createLogStreamName(meetingId, attendeeId) {
  return `ChimeSDKMeeting_${meetingId}_${attendeeId}`;
}

function response(statusCode, contentType, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body,
    isBase64Encoded: false
  };
}

function addSignalMetricsToCloudWatch(logMsg, meetingId, attendeeId) {
  const logMsgJson = JSON.parse(logMsg);
  const metricList = ['signalingOpenDurationMs', 'iceGatheringDurationMs', 'attendeePresenceDurationMs', 'meetingStartDurationMs'];
  const putMetric =
    metricScope(metrics => (metricName, metricValue, meetingId, attendeeId) => {
      metrics.setProperty('MeetingId', meetingId);
      metrics.setProperty('AttendeeId', attendeeId);
      metrics.putMetric(metricName, metricValue);
    });
  for (let metricIndex = 0; metricIndex <= metricList.length; metricIndex += 1) {
    const metricName = metricList[metricIndex];
    if (logMsgJson.attributes.hasOwnProperty(metricName)) {
      const metricValue = logMsgJson.attributes[metricName];
      console.log('Logging metric -> ', metricName, ': ', metricValue );
      putMetric(metricName, metricValue, meetingId, attendeeId);
    }
  }
}
