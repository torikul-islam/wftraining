// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * [[VideoFxAssetParams]] Is an interface for the specifications
 * that define the current version of the SDK.
 */
export interface VideoFxAssetParams {
  assetGroup: string;
  revisionID: string;
  // SDK Version
  sdk: string;
  // Browser setting (for example, chrome-110)
  ua: string;
}
