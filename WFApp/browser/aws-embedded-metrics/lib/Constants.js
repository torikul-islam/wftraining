"use strict";
/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates.
 * Licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var Constants;
(function (Constants) {
    Constants[Constants["MAX_DIMENSIONS"] = 9] = "MAX_DIMENSIONS";
    Constants["DEFAULT_NAMESPACE"] = "aws-embedded-metrics";
    Constants[Constants["MAX_METRICS_PER_EVENT"] = 100] = "MAX_METRICS_PER_EVENT";
    Constants["DEFAULT_AGENT_HOST"] = "0.0.0.0";
    Constants[Constants["DEFAULT_AGENT_PORT"] = 25888] = "DEFAULT_AGENT_PORT";
})(Constants = exports.Constants || (exports.Constants = {}));
