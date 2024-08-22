// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Eq, PartialOrd } from '../utils/Types';
import TargetDisplaySize from './TargetDisplaySize';

export default class VideoPreference implements Eq, PartialOrd {
  /**
   * The desired maximum simulcast layers to receive.
   */
  targetSize: TargetDisplaySize;

  /** Initializes a [[VideoPreference]] with the given properties.
   *
   * @param attendeeId Attendee ID of the client
   * @param priority The relative priority of this attendee against others.
   * @param targetSize The desired maximum simulcast layers to receive.
   */
  constructor(public attendeeId: string, public priority: number, targetSize?: TargetDisplaySize) {
    this.targetSize = targetSize !== undefined ? targetSize : TargetDisplaySize.High;
  }

  partialCompare(other: this): number {
    return this.priority - other.priority;
  }

  equals(other: this): boolean {
    return (
      this.attendeeId === other.attendeeId &&
      this.targetSize === other.targetSize &&
      this.priority === other.priority
    );
  }

  clone(): VideoPreference {
    return new VideoPreference(this.attendeeId, this.priority, this.targetSize);
  }

  private static readonly LOW_BITRATE_KBPS = 300;
  private static readonly MID_BITRATE_KBPS = 600;
  private static readonly HIGH_BITRATE_KBPS = 1200;

  targetSizeToBitrateKbps(targetSize: TargetDisplaySize): number {
    switch (targetSize) {
      case TargetDisplaySize.High:
        return VideoPreference.HIGH_BITRATE_KBPS;
      case TargetDisplaySize.Medium:
        return VideoPreference.MID_BITRATE_KBPS;
      case TargetDisplaySize.Low:
        return VideoPreference.LOW_BITRATE_KBPS;
    }
  }
}
