// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DataMessage from '../datamessage/DataMessage';
import {
  SdkTranscriptFrame,
  SdkTranscriptionStatus,
  SdkTranscriptItem,
} from '../signalingprotocol/SignalingProtocol';
import Transcript from './Transcript';
import TranscriptAlternative from './TranscriptAlternative';
import TranscriptEntity from './TranscriptEntity';
import TranscriptionStatus from './TranscriptionStatus';
import TranscriptionStatusType from './TranscriptionStatusType';
import TranscriptItem from './TranscriptItem';
import TranscriptItemType from './TranscriptItemType';
import TranscriptLanguageWithScore from './TranscriptLanguageWithScore';
import TranscriptResult from './TranscriptResult';

const TranscriptionStatusTypes = {
  [SdkTranscriptionStatus.Type.STARTED]: TranscriptionStatusType.STARTED,
  [SdkTranscriptionStatus.Type.INTERRUPTED]: TranscriptionStatusType.INTERRUPTED,
  [SdkTranscriptionStatus.Type.RESUMED]: TranscriptionStatusType.RESUMED,
  [SdkTranscriptionStatus.Type.STOPPED]: TranscriptionStatusType.STOPPED,
  [SdkTranscriptionStatus.Type.FAILED]: TranscriptionStatusType.FAILED,
};

type TranscriptEvent = Transcript | TranscriptionStatus;

export class TranscriptEventConverter {
  /**
   * Decodes a list of TranscriptEvent from a data message.
   * @param dataMessage Data message to decode from
   * @returns List of TranscriptEvent
   * @throws {Error} If the data message payload cannot be decoded
   */
  static from(dataMessage: DataMessage): TranscriptEvent[] {
    let frame;
    try {
      frame = SdkTranscriptFrame.decode(dataMessage.data);
    } catch (e) {
      throw new Error('Cannot decode transcript data message: ' + e);
    }

    const transcriptEvents: TranscriptEvent[] = [];
    for (const sdkTranscriptEvent of frame.events) {
      if (sdkTranscriptEvent.status) {
        const transcriptionStatusType = TranscriptionStatusTypes[sdkTranscriptEvent.status.type];
        if (!transcriptionStatusType) {
          continue;
        }
        const transcriptionStatus = new TranscriptionStatus();
        transcriptionStatus.type = transcriptionStatusType;
        transcriptionStatus.eventTimeMs = sdkTranscriptEvent.status.eventTime as number;
        transcriptionStatus.transcriptionRegion = sdkTranscriptEvent.status.transcriptionRegion;
        transcriptionStatus.transcriptionConfiguration =
          sdkTranscriptEvent.status.transcriptionConfiguration;

        if (sdkTranscriptEvent.status.message) {
          transcriptionStatus.message = sdkTranscriptEvent.status.message;
        }

        transcriptEvents.push(transcriptionStatus);
      } else if (sdkTranscriptEvent.transcript) {
        const transcript = new Transcript();
        transcript.results = [];

        for (const result of sdkTranscriptEvent.transcript.results) {
          const transcriptResult: TranscriptResult = {
            channelId: result.channelId,
            isPartial: result.isPartial,
            resultId: result.resultId,
            startTimeMs: result.startTime as number,
            endTimeMs: result.endTime as number,
            alternatives: [],
          };

          if (result.languageCode) {
            transcriptResult.languageCode = result.languageCode;
          }

          if (result.languageIdentification && result.languageIdentification.length > 0) {
            transcriptResult.languageIdentification = [];
            for (const languageIdentification of result.languageIdentification) {
              const transcriptLanguageWithScore: TranscriptLanguageWithScore = {
                languageCode: languageIdentification.languageCode,
                score: languageIdentification.score,
              };

              transcriptResult.languageIdentification.push(transcriptLanguageWithScore);
            }
          }

          for (const alternative of result.alternatives) {
            const transcriptAlternative: TranscriptAlternative = {
              items: [],
              transcript: alternative.transcript,
            };

            for (const item of alternative.items) {
              const transcriptItem: TranscriptItem = {
                content: item.content,
                attendee: {
                  attendeeId: item.speakerAttendeeId,
                  externalUserId: item.speakerExternalUserId,
                },
                startTimeMs: item.startTime as number,
                endTimeMs: item.endTime as number,
                type: null,
              };

              if (item.vocabularyFilterMatch) {
                transcriptItem.vocabularyFilterMatch = item.vocabularyFilterMatch;
              }

              if (item.hasOwnProperty('stable')) {
                transcriptItem.stable = item.stable;
              }

              if (item.hasOwnProperty('confidence')) {
                transcriptItem.confidence = item.confidence;
              }

              switch (item.type) {
                case SdkTranscriptItem.Type.PRONUNCIATION:
                  transcriptItem.type = TranscriptItemType.PRONUNCIATION;
                  break;
                case SdkTranscriptItem.Type.PUNCTUATION:
                  transcriptItem.type = TranscriptItemType.PUNCTUATION;
                  break;
              }

              transcriptAlternative.items.push(transcriptItem);
            }

            for (const entity of alternative.entities) {
              if (!transcriptAlternative.entities) {
                transcriptAlternative.entities = [];
              }
              const transcriptEntity: TranscriptEntity = {
                category: entity.category,
                confidence: entity.confidence,
                content: entity.content,
                startTimeMs: entity.startTime as number,
                endTimeMs: entity.endTime as number,
              };

              if (entity.type) {
                transcriptEntity.type = entity.type;
              }
              transcriptAlternative.entities.push(transcriptEntity);
            }

            transcriptResult.alternatives.push(transcriptAlternative);
          }

          transcript.results.push(transcriptResult);
        }

        transcriptEvents.push(transcript);
      }
    }

    return transcriptEvents;
  }
}

export default TranscriptEvent;
