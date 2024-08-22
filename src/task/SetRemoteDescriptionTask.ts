// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import AudioVideoControllerState from '../audiovideocontroller/AudioVideoControllerState';
import SDP from '../sdp/SDP';
import BaseTask from './BaseTask';

/*
 * [[SetRemoteDescriptionTask]] asynchronously calls [[setRemoteDescription]] on the
 * peer connection and then waits for the tracks to be added and for the ICE connection
 * to complete.
 */
export default class SetRemoteDescriptionTask extends BaseTask {
  protected taskName = 'SetRemoteDescriptionTask';

  private cancelICEPromise: () => void;

  constructor(private context: AudioVideoControllerState) {
    super(context.logger);
  }

  cancel(): void {
    if (this.cancelICEPromise) {
      this.cancelICEPromise();
    }
  }

  async run(): Promise<void> {
    const peer = this.context.peer;
    if (!peer) {
      this.logAndThrow('session does not have peer connection; bypass set remote description');
    }

    let sdp = this.context.sdpAnswer;
    sdp = new SDP(sdp).withoutServerReflexiveCandidates().sdp;
    if (this.context.audioProfile) {
      sdp = new SDP(sdp).withAudioMaxAverageBitrate(this.context.audioProfile.audioBitrateBps).sdp;
      if (this.context.audioProfile.isStereo()) {
        sdp = new SDP(sdp).withStereoAudio().sdp;
      }
    }

    if (
      this.context.videoSendCodecPreferences !== undefined &&
      this.context.videoSendCodecPreferences.length > 0
    ) {
      sdp = new SDP(sdp).withVideoSendCodecPreferences(
        this.context.meetingSupportedVideoSendCodecPreferences !== undefined
          ? this.context.meetingSupportedVideoSendCodecPreferences
          : this.context.videoSendCodecPreferences
      ).sdp;
      this.context.currentVideoSendCodec = new SDP(sdp).highestPriorityVideoSendCodec();
    }

    this.logger.info(`processed remote description is >>>${sdp}<<<`);
    const remoteDescription: RTCSessionDescription = {
      type: 'answer',
      sdp: sdp,
      toJSON: null,
    };

    try {
      await this.createICEConnectionCompletedPromise(remoteDescription);
    } catch (err) {
      throw err;
    }
  }

  private createICEConnectionCompletedPromise(
    remoteDescription: RTCSessionDescription
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const checkConnectionCompleted = (): void => {
        if (
          this.context.peer.iceConnectionState === 'connected' ||
          this.context.peer.iceConnectionState === 'completed'
        ) {
          this.context.peer.removeEventListener(
            'iceconnectionstatechange',
            checkConnectionCompleted
          );
          resolve();
        }
      };

      this.cancelICEPromise = () => {
        if (this.context.peer) {
          this.context.peer.removeEventListener(
            'iceconnectionstatechange',
            checkConnectionCompleted
          );
        }
        reject(new Error(`${this.name()} got canceled while waiting for the ICE connection state`));
      };

      this.context.peer.addEventListener('iceconnectionstatechange', checkConnectionCompleted);

      try {
        await this.context.peer.setRemoteDescription(remoteDescription);
        this.logger.info('set remote description, waiting for ICE connection');
        checkConnectionCompleted();
      } catch (err) {
        reject(err);
      }
    });
  }
}
