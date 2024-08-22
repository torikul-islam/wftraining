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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Configuration_1 = require("../config/Configuration");
const AgentSink_1 = require("../sinks/AgentSink");
const Fetch_1 = require("../utils/Fetch");
const Logger_1 = require("../utils/Logger");
const endpoint = 'http://169.254.169.254/latest/dynamic/instance-identity/document';
class EC2Environment {
    probe() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.metadata = yield Fetch_1.fetch(endpoint);
                if (this.metadata) {
                    return true;
                }
                return false;
            }
            catch (e) {
                Logger_1.LOG(e);
                return false;
            }
        });
    }
    getName() {
        if (!Configuration_1.default.serviceName) {
            Logger_1.LOG('Unknown ServiceName.');
            return 'Unknown';
        }
        return Configuration_1.default.serviceName;
    }
    getType() {
        if (this.metadata) {
            return 'AWS::EC2::Instance';
        }
        // this will only happen if probe() is not called first
        return 'Unknown';
    }
    getLogGroupName() {
        return Configuration_1.default.logGroupName ? Configuration_1.default.logGroupName : `${this.getName()}-metrics`;
    }
    configureContext(context) {
        if (this.metadata) {
            context.setProperty('imageId', this.metadata.imageId);
            context.setProperty('instanceId', this.metadata.instanceId);
            context.setProperty('instanceType', this.metadata.instanceType);
            context.setProperty('privateIP', this.metadata.privateIp);
            context.setProperty('availabilityZone', this.metadata.availabilityZone);
        }
    }
    getSink() {
        if (!this.sink) {
            this.sink = new AgentSink_1.AgentSink(this.getLogGroupName(), Configuration_1.default.logStreamName);
        }
        return this.sink;
    }
}
exports.EC2Environment = EC2Environment;
