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
const MetricsContext_1 = require("./MetricsContext");
/**
 * An async metrics logger.
 * Use this interface to publish logs to CloudWatch Logs
 * and extract metrics to CloudWatch Metrics asynchronously.
 */
class MetricsLogger {
    constructor(resolveEnvironment, context) {
        this.configureContextForEnvironment = (context, environment) => {
            const defaultDimensions = {
                // LogGroup name will entirely depend on the environment since there
                // are some cases where the LogGroup cannot be configured (e.g. Lambda)
                LogGroup: environment.getLogGroupName(),
                ServiceName: Configuration_1.default.serviceName || environment.getName(),
                ServiceType: Configuration_1.default.serviceType || environment.getType(),
            };
            context.setDefaultDimensions(defaultDimensions);
            environment.configureContext(context);
        };
        this.resolveEnvironment = resolveEnvironment;
        this.context = context || MetricsContext_1.MetricsContext.empty();
    }
    /**
     * Flushes the current context state to the configured sink.
     */
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            // resolve the environment and get the sink
            // MOST of the time this will run synchonrously
            // This only runs asynchronously if executing for the
            // first time in a non-lambda environment
            const environment = yield this.resolveEnvironment();
            this.configureContextForEnvironment(this.context, environment);
            const sink = environment.getSink();
            // accept and reset the context
            sink.accept(this.context);
            this.context = this.context.createCopyWithContext();
        });
    }
    /**
     * Set a property on the published metrics.
     * This is stored in the emitted log data and you are not
     * charged for this data by CloudWatch Metrics.
     * These values can be values that are useful for searching on,
     * but have too high cardinality to emit as dimensions to
     * CloudWatch Metrics.
     *
     * @param key Property name
     * @param value Property value
     */
    setProperty(key, value) {
        this.context.setProperty(key, value);
        return this;
    }
    /**
     * Adds a dimension.
     * This is generally a low cardinality key-value pair that is part of the metric identity.
     * CloudWatch treats each unique combination of dimensions as a separate metric, even if the metrics have the same metric name.
     *
     * @param dimension
     * @param value
     * @see [CloudWatch Dimensions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Dimension)
     */
    putDimensions(dimensions) {
        this.context.putDimensions(dimensions);
        return this;
    }
    /**
     * Overwrite all dimensions on this MetricsLogger instance.
     *
     * @param dimensionSets
     * @see [CloudWatch Dimensions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Dimension)
     */
    setDimensions(...dimensionSets) {
        this.context.setDimensions(dimensionSets);
        return this;
    }
    /**
     * Put a metric value.
     * This value will be emitted to CloudWatch Metrics asyncronously and does not contribute to your
     * account TPS limits. The value will also be available in your CloudWatch Logs
     * @param key
     * @param value
     * @param unit
     */
    putMetric(key, value, unit) {
        this.context.putMetric(key, value, unit);
        return this;
    }
    /**
     * Set the CloudWatch namespace that metrics should be published to.
     * @param value
     */
    setNamespace(value) {
        this.context.setNamespace(value);
        return this;
    }
    /**
     * Set the timestamp of metrics emitted in this context.
     *
     * If not set, the timestamp will default to new Date() at the point
     * the context is constructed.
     *
     * If set, timestamp will preserved across calls to flush().
     *
     * @param timestamp
     */
    setTimestamp(timestamp) {
        this.context.setTimestamp(timestamp);
        return this;
    }
    /**
     * Creates a new logger using the same contextual data as
     * the previous logger. This allows you to flush the instances
     * independently.
     */
    new() {
        return new MetricsLogger(this.resolveEnvironment, this.context.createCopyWithContext());
    }
}
exports.MetricsLogger = MetricsLogger;
