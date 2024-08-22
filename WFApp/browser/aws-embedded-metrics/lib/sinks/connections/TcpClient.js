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
const net = require("net");
const Logger_1 = require("../../utils/Logger");
class TcpClient {
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.socket = new net.Socket({ allowHalfOpen: true, writable: false })
            .setEncoding('utf8')
            .setKeepAlive(true)
            .setTimeout(5000) // idle timeout
            .on('timeout', () => this.disconnect('idle timeout'))
            .on('end', () => this.disconnect('end'))
            .on('data', data => Logger_1.LOG('TcpClient received data.', data));
    }
    warmup() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.establishConnection();
            }
            catch (err) {
                Logger_1.LOG('Failed to connect', err);
            }
        });
    }
    sendMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            // ensure the socket is open and writable
            yield this.waitForOpenConnection();
            yield new Promise((resolve, reject) => {
                const onSendError = (err) => {
                    Logger_1.LOG('Failed to write', err);
                    reject(err);
                };
                const wasFlushedToKernel = this.socket.write(message, (err) => {
                    if (!err) {
                        Logger_1.LOG('Write succeeded');
                        resolve();
                    }
                    else {
                        onSendError(err);
                    }
                });
                if (!wasFlushedToKernel) {
                    Logger_1.LOG('TcpClient data was not flushed to kernel buffer and was queued in memory.');
                }
            });
        });
    }
    disconnect(eventName) {
        Logger_1.LOG('TcpClient disconnected due to:', eventName);
        this.socket.removeAllListeners();
        this.socket.destroy();
        this.socket.unref();
    }
    waitForOpenConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.socket.writeable || this.socket.readyState !== 'open') {
                yield this.establishConnection();
            }
        });
    }
    establishConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                const onError = (e) => {
                    // socket is already open, no need to connect
                    if (e.message.includes('EISCONN')) {
                        resolve();
                        return;
                    }
                    Logger_1.LOG('TCP Client received error', e);
                    this.disconnect(e.message);
                    reject(e);
                };
                const onConnect = () => {
                    this.socket.removeListener('error', onError);
                    Logger_1.LOG('TcpClient connected.', this.endpoint);
                    resolve();
                };
                // TODO: convert this to a proper state machine
                switch (this.socket.readyState) {
                    case 'open':
                        resolve();
                        break;
                    case 'opening':
                        // the socket is currently opening, we will resolve
                        // or fail the current promise on the connect or
                        // error events
                        this.socket.once('connect', onConnect);
                        this.socket.once('error', onError);
                        break;
                    default:
                        Logger_1.LOG('opening connection with socket in state: ', this.socket.readyState);
                        this.socket.connect(this.endpoint.port, this.endpoint.host, onConnect).once('error', onError);
                        break;
                }
            });
        });
    }
}
exports.TcpClient = TcpClient;
