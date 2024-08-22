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
const os = require("os");
const Constants_1 = require("../Constants");
// formats image names into something more readable for a metric name
// e.g. <account-id>.dkr.ecr.<region>.amazonaws.com/<image-name>:latest -> <image-name>:latest
const formatImageName = (imageName) => {
    if (imageName) {
        const splitImageName = imageName.split('/');
        return splitImageName[splitImageName.length - 1];
    }
    return imageName;
};
class ECSEnvironment {
    probe() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.ECS_CONTAINER_METADATA_URI) {
                return Promise.resolve(false);
            }
            if (process.env.FLUENT_HOST && !Configuration_1.default.agentEndpoint) {
                this.fluentBitEndpoint = `tcp://${process.env.FLUENT_HOST}:${Constants_1.Constants.DEFAULT_AGENT_PORT}`;
                Configuration_1.default.agentEndpoint = this.fluentBitEndpoint;
                Logger_1.LOG(`Using FluentBit configuration. Endpoint: ${this.fluentBitEndpoint}`);
            }
            try {
                this.metadata = yield Fetch_1.fetch(process.env.ECS_CONTAINER_METADATA_URI);
                if (this.metadata) {
                    this.metadata.FormattedImageName = formatImageName(this.metadata.Image);
                    Logger_1.LOG(`Successfully collected ECS Container metadata.`);
                }
            }
            catch (e) {
                Logger_1.LOG('Failed to collect ECS Container Metadata.');
                Logger_1.LOG(e);
            }
            // return true regardless of whether or not metadata collection
            // succeeded. we know that this is supposed to be an ECS environment
            // just from the environment variable
            return true;
        });
    }
    getName() {
        var _a;
        if (Configuration_1.default.serviceName) {
            return Configuration_1.default.serviceName;
        }
        return ((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.FormattedImageName) ? this.metadata.FormattedImageName : 'Unknown';
    }
    getType() {
        return 'AWS::ECS::Container';
    }
    getLogGroupName() {
        // FireLens / fluent-bit does not need the log group to be included
        // since configuration of the LogGroup is handled by the
        // fluent bit config file
        if (this.fluentBitEndpoint) {
            return '';
        }
        return Configuration_1.default.logGroupName || this.getName();
    }
    configureContext(context) {
        var _a, _b, _c, _d, _e;
        this.addProperty(context, 'containerId', os.hostname());
        this.addProperty(context, 'createdAt', (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.CreatedAt);
        this.addProperty(context, 'startedAt', (_b = this.metadata) === null || _b === void 0 ? void 0 : _b.StartedAt);
        this.addProperty(context, 'image', (_c = this.metadata) === null || _c === void 0 ? void 0 : _c.Image);
        this.addProperty(context, 'cluster', (_d = this.metadata) === null || _d === void 0 ? void 0 : _d.Labels['com.amazonaws.ecs.cluster']);
        this.addProperty(context, 'taskArn', (_e = this.metadata) === null || _e === void 0 ? void 0 : _e.Labels['com.amazonaws.ecs.task-arn']);
        // we override the standard default dimensions here because in the
        // FireLens / fluent-bit case, we don't need the LogGroup
        if (this.fluentBitEndpoint) {
            context.setDefaultDimensions({
                ServiceName: Configuration_1.default.serviceName || this.getName(),
                ServiceType: Configuration_1.default.serviceType || this.getType(),
            });
        }
    }
    getSink() {
        if (!this.sink) {
            const logGroupName = this.fluentBitEndpoint ? '' : this.getLogGroupName();
            this.sink = new AgentSink_1.AgentSink(logGroupName);
        }
        return this.sink;
    }
    addProperty(context, key, value) {
        if (value) {
            context.setProperty(key, value);
        }
    }
}
exports.ECSEnvironment = ECSEnvironment;
