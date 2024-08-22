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
const dgram = require("dgram");
const Logger_1 = require("../../utils/Logger");
class UdpClient {
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    // No warm up for UDP
    warmup() {
        return Promise.resolve();
    }
    sendMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = dgram.createSocket('udp4');
            client.send(message, this.endpoint.port, this.endpoint.host, (error) => {
                if (error) {
                    Logger_1.LOG(error);
                }
                client.close();
            });
            return Promise.resolve();
        });
    }
}
exports.UdpClient = UdpClient;
