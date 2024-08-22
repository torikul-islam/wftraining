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
const Configuration_1 = require("../config/Configuration");
const Logger_1 = require("../utils/Logger");
const MetricValues_1 = require("./MetricValues");
class MetricsContext {
    /**
     * Constructor used to create child instances.
     * You should not use this constructor directly.
     * Instead, use createCopyWithContext() or empty().
     *
     * The reason for this is to avoid unexpected behavior when creating
     * MetricsContexts with defaultDimensions and existing dimensions.
     *
     * @param properties
     * @param dimensions
     */
    constructor(namespace, properties, dimensions, defaultDimensions, shouldUseDefaultDimensions, timestamp) {
        this.metrics = new Map();
        this.meta = {};
        this.shouldUseDefaultDimensions = true;
        this.namespace = namespace || Configuration_1.default.namespace;
        this.properties = properties || {};
        this.dimensions = dimensions || [];
        this.timestamp = timestamp;
        this.meta.Timestamp = MetricsContext.resolveMetaTimestamp(timestamp);
        this.defaultDimensions = defaultDimensions || {};
        if (shouldUseDefaultDimensions != undefined) {
            this.shouldUseDefaultDimensions = shouldUseDefaultDimensions;
        }
    }
    /**
     * Use this to create a new, empty context.
     */
    static empty() {
        return new MetricsContext();
    }
    static resolveMetaTimestamp(timestamp) {
        if (timestamp instanceof Date) {
            return timestamp.getTime();
        }
        else if (timestamp) {
            return timestamp;
        }
        else {
            return new Date().getTime();
        }
    }
    setNamespace(value) {
        this.namespace = value;
    }
    setProperty(key, value) {
        this.properties[key] = value;
    }
    setTimestamp(timestamp) {
        this.timestamp = timestamp;
        this.meta.Timestamp = MetricsContext.resolveMetaTimestamp(timestamp);
    }
    /**
     * Sets default dimensions for the Context.
     * A dimension set will be created with just the default dimensions
     * and all calls to putDimensions will be prepended with the defaults.
     */
    setDefaultDimensions(dimensions) {
        Logger_1.LOG(`Received default dimensions`, dimensions);
        this.defaultDimensions = dimensions;
    }
    /**
     * Adds a new set of dimensions. Any time a new dimensions set
     * is added, the set is first prepended by the default dimensions.
     *
     * @param dimensions
     */
    putDimensions(incomingDimensionSet) {
        if (this.dimensions.length === 0) {
            this.dimensions.push(incomingDimensionSet);
            return;
        }
        for (let i = 0; i < this.dimensions.length; i++) {
            const existingDimensionSet = this.dimensions[i];
            // check for duplicate dimensions when putting
            // this is an O(n^2) operation, but since we never expect to have more than
            // 10 dimensions, this is acceptable for almost all cases.
            // This makes re-using loggers much easier.
            const existingDimensionSetKeys = Object.keys(existingDimensionSet);
            const incomingDimensionSetKeys = Object.keys(incomingDimensionSet);
            if (existingDimensionSetKeys.length !== incomingDimensionSetKeys.length) {
                this.dimensions.push(incomingDimensionSet);
                return;
            }
            for (let j = 0; j < existingDimensionSetKeys.length; j++) {
                if (!incomingDimensionSetKeys.includes(existingDimensionSetKeys[j])) {
                    // we're done now because we know that the dimensions keys are not identical
                    this.dimensions.push(incomingDimensionSet);
                    return;
                }
            }
        }
    }
    /**
     * Overwrite all dimensions.
     *
     * @param dimensionSets
     */
    setDimensions(dimensionSets) {
        this.shouldUseDefaultDimensions = false;
        this.dimensions = dimensionSets;
    }
    /**
     * Get the current dimensions.
     */
    getDimensions() {
        // caller has explicitly called setDimensions
        if (this.shouldUseDefaultDimensions === false) {
            return this.dimensions;
        }
        // if there are no default dimensions, return the custom dimensions
        if (Object.keys(this.defaultDimensions).length === 0) {
            return this.dimensions;
        }
        // if default dimensions have been provided, but no custom dimensions, use the defaults
        if (this.dimensions.length === 0) {
            return [this.defaultDimensions];
        }
        // otherwise, merge the dimensions
        // we do this on the read path because default dimensions
        // may get updated asynchronously by environment detection
        return this.dimensions.map(custom => {
            return Object.assign(Object.assign({}, this.defaultDimensions), custom);
        });
    }
    putMetric(key, value, unit) {
        const currentMetric = this.metrics.get(key);
        if (currentMetric) {
            currentMetric.addValue(value);
        }
        else {
            this.metrics.set(key, new MetricValues_1.MetricValues(value, unit));
        }
    }
    /**
     * Creates an independently flushable context.
     */
    createCopyWithContext() {
        return new MetricsContext(this.namespace, Object.assign({}, this.properties), Object.assign([], this.dimensions), this.defaultDimensions, this.shouldUseDefaultDimensions, this.timestamp);
    }
}
exports.MetricsContext = MetricsContext;
