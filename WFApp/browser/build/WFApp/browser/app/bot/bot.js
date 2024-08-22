"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkoutBotApp = exports.ContentShareType = void 0;
require("./bot.scss");
require("bootstrap");
const index_1 = require("../../../../src/index");
const volume_1 = require("./volume");
class TileOrganizer {
    constructor() {
        this.tiles = {};
        this.tileStates = {};
        this.remoteTileCount = 0;
    }
    acquireTileIndex(tileId) {
        for (let index = 0; index <= TileOrganizer.MAX_TILES; index++) {
            if (this.tiles[index] === tileId) {
                return index;
            }
        }
        for (let index = 0; index <= TileOrganizer.MAX_TILES; index++) {
            if (!(index in this.tiles)) {
                this.tiles[index] = tileId;
                this.remoteTileCount++;
                return index;
            }
        }
        throw new Error('no tiles are available');
    }
    releaseTileIndex(tileId) {
        for (let index = 0; index <= TileOrganizer.MAX_TILES; index++) {
            if (this.tiles[index] === tileId) {
                this.remoteTileCount--;
                delete this.tiles[index];
                return index;
            }
        }
        return TileOrganizer.MAX_TILES;
    }
}
// this is index instead of length
TileOrganizer.MAX_TILES = 17;
var ContentShareType;
(function (ContentShareType) {
    ContentShareType[ContentShareType["ScreenCapture"] = 0] = "ScreenCapture";
    ContentShareType[ContentShareType["VideoFile"] = 1] = "VideoFile";
    ContentShareType[ContentShareType["CanvasCapture"] = 2] = "CanvasCapture";
})(ContentShareType = exports.ContentShareType || (exports.ContentShareType = {}));
;
const ROLE_TRAINER = "1";
class WorkoutBotApp {
    constructor() {
        this.workoutId = '0';
        this.bVirtualCoachWorkout = false;
        this.bWithoutCoach = false;
        this.bShowingRecordedCoachVideo = false;
        this.bTrainerJoined = false;
        // coachVideoUrl: string = "https://wf-prod-video.s3.us-west-2.amazonaws.com/WorkoutExerciseVideos/RecordFiles/331_video_10c40869-4b5d-6841-03cc-322617784f44.mp4";
        // coachAudioUrl: string = "https://trainingroomfiles.s3.us-west-2.amazonaws.com/NextUp21s.mp3";
        this.taskId = '';
        this.timeLeft = 0;
        this.role = 'Bot';
        this.customerId = '';
        this.roomId = "";
        this.videoIndex = 0;
        this.nextVideoElementIndex = -1;
        this.videoElementIndex = -1;
        this.videoCanvasContext = null;
        this.videoCanvas = null;
        this.isWorkoutPaused = false;
        this.isWorkoutOver = false;
        this.contentStream = null;
        this.nextVideoTimeoutHandler = null;
        this.mainProcessTimeoutHandler = null;
        this.res_path = "";
        this.videoList = [];
        this.strNextVideoTitle = "";
        this.strVideoTitle = "";
        this.jsPlayFlag = false;
        this.curVideoPos = 0;
        this.bStatusSwooshPlaying = false;
        this.bTimerStarted = false;
        this.welcomeTime = 0;
        this.bVideoPaused = true;
        this.bShowingNextVideoClip = false;
        this.bTimerActivated = false;
        this.bSwitchActivated = false;
        this.bPlayingCoachPreviewAudio = false;
        this.cw = 1080;
        this.ch = 1920;
        this.songUrl = null;
        this.nextMusicElementIndex = -1;
        this.musicElementIndex = -1;
        this.showActiveSpeakerScores = false;
        this.activeSpeakerLayout = true;
        this.meeting = null;
        this.name = null;
        this.voiceConnectorId = null;
        this.sipURI = null;
        this.region = null;
        this.meetingSession = null;
        this.audioVideo = null;
        this.tileOrganizer = new TileOrganizer();
        this.canStartLocalVideo = true;
        this.defaultBrowserBehaviour = new index_1.DefaultBrowserBehavior();
        // eslint-disable-next-line
        this.roster = {};
        this.tileIndexToTileId = {};
        this.tileIdToTileIndex = {};
        this.tileArea = document.getElementById('tile-area');
        this.coachVideoVolume = 1;
        this.memberMusicVolume = 0.7;
        this.bPrivateChating = false;
        this.cameraDeviceIds = [];
        this.microphoneDeviceIds = [];
        this.buttonStates = {
            'button-microphone': true,
            'button-camera': false,
            'button-speaker': true,
            'button-content-share': false,
            'button-pause-content-share': false,
        };
        this.contentShareType = ContentShareType.ScreenCapture;
        // feature flags
        this.enableWebAudio = false;
        this.enableUnifiedPlanForChromiumBasedBrowsers = true;
        this.enableSimulcast = false;
        this.markdown = require('markdown-it')({ linkify: true });
        this.lastMessageSender = null;
        this.lastReceivedMessageTimestamp = 0;
        this.api_base_url = null;
        this.analyserNodeCallback = () => { };
        this.selectedVideoInput = null;
        var url = window.location.href;
        var arr = url.split("/");
        var result = arr[2];
        if (result == "devstudio.webfitness.com") {
            this.api_base_url = "https://dev.webfitness.com/";
        }
        else if (result == "studio.webfitness.com") {
            this.api_base_url = "https://webfitness.com/";
        }
        else {
            this.api_base_url = "https://dev.webfitness.com/";
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        global.app = this;
        document.getElementById('sdk-version').innerText =
            "amazon-chime-sdk-js@" + index_1.Versioning.sdkVersion;
        this.setMediaRegion();
        let qs = this.AccessValueOfQueryString();
        this.classScheduleId = qs['ClassScheduleId'];
        this.workoutId = qs['WorkoutId'];
        this.customerId = qs['CustomerId'];
        this.startProcess();
    }
    updatePulseData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(this.api_base_url + `Home/GetCustomerPulseByClassScheduleId?ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`, {
                    method: 'POST',
                    mode: 'cors'
                });
                const json = yield response.json();
                //      console.log("pulse data:"+JSON.stringify(json));
                if (json.Status == true) {
                    this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_PULSE_DATA, JSON.stringify(json.Data), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                }
            }
            catch (error) {
                console.error(error.message);
                return;
            }
            new index_1.TimeoutScheduler(2000).start(() => __awaiter(this, void 0, void 0, function* () {
                this.updatePulseData();
            }));
        });
    }
    decode(s) {
        return decodeURIComponent(s.replace(/\+/g, "%2B"));
        // return decodeURIComponent();
    }
    ;
    AccessValueOfQueryString() {
        let assoc = {};
        let queryString = location.search.substring(1);
        let keyValues = queryString.split('&');
        for (let i in keyValues) {
            let n = keyValues[i].indexOf("=");
            let key1 = keyValues[i].substr(n + 1, keyValues[i].length);
            let key2 = keyValues[i].substr(0, n);
            if (key1.length > 0) {
                assoc[this.decode(key2)] = this.decode(key1);
            }
        }
        return assoc;
    }
    endVideo() {
        console.log('endVideo');
        this.clearCanvas();
        this.isWorkoutOver = true;
        // this.bShowingRecordedCoachVideo = false;
        // this.resetCanvasSize();
        this.drawImageOnCanvas(this.imgLogo);
        let jsonMsg = {
            "id": "EndVideo"
        };
        this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
    }
    playPreviewAudio() {
        if (this.coachVideoVolume > 0.1)
            this.currentCoachVideoElement.volume = 0.1;
        this.coachPreviewAudioElement.play();
        this.bPlayingCoachPreviewAudio = true;
    }
    playNextVideoClip() {
        if (this.videoIndex >= this.videoInfoList.Data.length - 1 || this.videoInfoList.Data[this.videoIndex + 1].ControlName)
            return;
        console.log("nextvideo:" + this.videoInfoList.Data[this.videoIndex + 1].ControlName);
        if (this.videoInfoList.Data[this.videoIndex + 1].ControlName != 'Welcome' && this.videoInfoList.Data[this.videoIndex + 1].ControlName != 'Logo'
            && this.videoInfoList.Data[this.videoIndex + 1].ControlName != 'Go Time' && this.videoInfoList.Data[this.videoIndex + 1].ControlName != 'Rest'
            && this.videoInfoList.Data[this.videoIndex + 1].ControlName != 'Water') {
            this.strNextVideoTitle = this.videoInfoList.Data[this.videoIndex + 1].ExerciseName;
            if (!this.strNextVideoTitle)
                this.strNextVideoTitle = this.videoInfoList.Data[this.videoIndex + 1].ControlName;
        }
        else {
            this.strNextVideoTitle = this.videoInfoList.Data[this.videoIndex + 1].ControlName;
        }
        if (this.videoIndex == this.videoInfoList.Data.length - 2)
            this.strNextVideoTitle = "Almost Done";
        this.bShowingNextVideoClip = true;
        if (this.videoIndex + 1 == this.nextVideoElementIndex) {
            this.workoutNextVideoElement.muted = true;
            if (this.videoInfoList.Data[this.videoIndex + 1].Switching == 1) {
                this.workoutNextVideoElement.currentTime = (this.videoInfoList.Data[this.videoIndex + 1].ExerciseVideoDuration - this.videoInfoList.Data[this.videoIndex + 1].Duration) / 2;
            }
            else
                this.workoutNextVideoElement.currentTime = 0; //30; //just for testing
            this.workoutNextVideoElement.play();
        }
        else if (this.videoIndex + 1 == this.videoElementIndex) {
            this.workoutVideoElement.muted = true;
            if (this.videoInfoList.Data[this.videoIndex + 1].Switching == 1) {
                this.workoutVideoElement.currentTime = (this.videoInfoList.Data[this.videoIndex + 1].ExerciseVideoDuration - this.videoInfoList.Data[this.videoIndex + 1].Duration) / 2;
            }
            else
                this.workoutVideoElement.currentTime = 0; //30; //just for testing
            this.workoutVideoElement.play();
        }
        // let jsonMsg = {
        //   "id": "PlayNextVideoClip",
        //   "videoIndex": this.videoIndex,
        //   "currentPos": this.curVideoPos
        // };
        // this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg),WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
        this.audioSwooshShort.play();
    }
    playNextVideo() {
        console.log('messages: videoIndex:' + this.videoIndex);
        if (this.videoIndex >= this.videoInfoList.Data.length - 1) {
            this.endVideo();
            return;
        }
        this.curVideoPos = 0;
        this.coachVideoElement1.volume = this.coachVideoVolume;
        this.coachVideoElement2.volume = this.coachVideoVolume;
        this.bTimerActivated = false;
        this.bSwitchActivated = false;
        this.bShowingNextVideoClip = false;
        if (this.bWithoutCoach) {
            this.bPlayingCoachPreviewAudio = false;
            if (!this.coachPreviewAudioElement.paused && !this.coachPreviewAudioElement.ended)
                this.coachPreviewAudioElement.pause();
        }
        if (this.nextVideoElementIndex == this.videoIndex + 1) {
            if (!this.workoutNextVideoElement.paused && !this.workoutNextVideoElement.ended)
                this.workoutNextVideoElement.pause();
            this.workoutNextVideoElement.muted = true;
            if (this.videoInfoList.Data[this.videoIndex + 1].Switching == 1) {
                this.workoutNextVideoElement.currentTime = (this.videoInfoList.Data[this.videoIndex + 1].ExerciseVideoDuration - this.videoInfoList.Data[this.videoIndex + 1].Duration) / 2;
            }
            else
                this.workoutNextVideoElement.currentTime = 0;
            this.workoutNextVideoElement.play();
            this.currentVideoElement = this.workoutNextVideoElement;
        }
        else if (this.videoElementIndex == this.videoIndex + 1) {
            if (!this.workoutVideoElement.paused && !this.workoutVideoElement.ended)
                this.workoutVideoElement.pause();
            this.workoutVideoElement.muted = true;
            if (this.videoInfoList.Data[this.videoIndex + 1].Switching == 1) {
                this.workoutVideoElement.currentTime = (this.videoInfoList.Data[this.videoIndex + 1].ExerciseVideoDuration - this.videoInfoList.Data[this.videoIndex + 1].Duration) / 2;
            }
            else
                this.workoutVideoElement.currentTime = 0;
            this.workoutVideoElement.play();
            this.currentVideoElement = this.workoutVideoElement;
        }
        if (this.videoIndex == this.videoElementIndex) {
            if (this.nextVideoElementIndex != -1) {
                this.videoElementIndex = this.findNextVideoIndex(this.nextVideoElementIndex + 1);
                if (this.videoElementIndex != -1) {
                    this.workoutVideoElement.src = this.videoInfoList.Data[this.videoElementIndex].VideoFile;
                }
            }
        }
        else if (this.videoIndex == this.nextVideoElementIndex) {
            this.nextVideoElementIndex = this.findNextVideoIndex(this.videoElementIndex + 1);
            if (this.nextVideoElementIndex != -1) {
                this.workoutNextVideoElement.src = this.videoInfoList.Data[this.nextVideoElementIndex].VideoFile;
            }
        }
        this.videoIndex++;
        this.videoInfo = this.videoInfoList.Data[this.videoIndex];
        console.log("playNextVideo:" + this.videoIndex + ":" + this.videoInfo.ExerciseName);
        console.log("playNextVideo:video1:" + this.videoElementIndex);
        console.log("playNextVideo:video2:" + this.nextVideoElementIndex);
        if (this.videoIndex < this.videoInfoList.Data.length - 1 && this.videoInfo.ControlName != "Custom Text & Image") {
            if (this.videoInfoList.Data[this.videoIndex + 1].ControlName == "Custom Text & Image") {
                this.imgCustom.src = this.videoInfoList.Data[this.videoIndex + 1].CustomImage;
            }
        }
        if (this.videoInfo.ControlName == "Welcome" || this.videoInfo.MusicFile == null) {
            if (this.currentMusicElement && !this.currentMusicElement.paused && !this.currentMusicElement.ended)
                this.currentMusicElement.pause();
        }
        else {
            if (this.videoInfoList.HasOneSong != true) {
                if (this.currentMusicElement && this.currentMusicElement.src != this.videoInfo.MusicFile) {
                    if (!this.currentMusicElement.paused && !this.currentMusicElement.ended)
                        this.currentMusicElement.pause();
                    if (this.currentMusicElement == this.musicElement1) {
                        this.musicElementIndex = this.findNextMusicIndex(this.nextMusicElementIndex + 1, this.musicElement2.src);
                        if (this.musicElementIndex != -1)
                            this.musicElement1.src = this.videoInfoList.Data[this.musicElementIndex].MusicFile;
                    }
                    else {
                        this.nextMusicElementIndex = this.findNextMusicIndex(this.musicElementIndex + 1, this.musicElement1.src);
                        if (this.nextMusicElementIndex != -1)
                            this.musicElement2.src = this.videoInfoList.Data[this.nextMusicElementIndex].MusicFile;
                    }
                    if (this.videoInfo.MusicFile == this.musicElement1.src) {
                        this.currentMusicElement = this.musicElement1;
                        this.currentMusicElement.play();
                    }
                    if (this.videoInfo.MusicFile == this.musicElement2.src) {
                        this.currentMusicElement = this.musicElement2;
                        this.currentMusicElement.play();
                    }
                }
                else {
                    if (!this.currentMusicElement)
                        this.currentMusicElement = this.musicElement1;
                    if (this.currentMusicElement.paused || this.currentMusicElement.ended)
                        this.currentMusicElement.play();
                }
            }
            else {
                if (!this.currentMusicElement)
                    this.currentMusicElement = this.musicElement1;
                if (this.currentMusicElement.paused || this.currentMusicElement.ended)
                    this.currentMusicElement.play();
            }
        }
        console.log('check coach mode:' + this.bVirtualCoachWorkout + ' ' + this.bTrainerJoined + ' ' + this.bShowingRecordedCoachVideo + ' ' + this.bWithoutCoach);
        if ( /*!this.bVirtualCoachWorkout &&*/!this.bTrainerJoined && !this.bWithoutCoach) {
            this.bWithoutCoach = true;
            this.bShowingRecordedCoachVideo = true;
            this.resetCanvasSize();
            console.log('switch to virtual coach mode');
        }
        if (this.bWithoutCoach) {
            if (this.currentCoachVideoElement && !this.currentCoachVideoElement.paused && !this.currentCoachVideoElement.ended)
                this.currentCoachVideoElement.pause();
            if (this.currentCoachVideoElement == this.coachVideoElement1) {
                this.currentCoachVideoElement = this.coachVideoElement2;
                if (this.videoIndex < this.videoInfoList.Data.length - 1)
                    this.coachVideoElement1.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedVideoFile;
            }
            else {
                this.currentCoachVideoElement = this.coachVideoElement1;
                if (this.videoIndex < this.videoInfoList.Data.length - 1)
                    this.coachVideoElement2.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedVideoFile;
            }
            if (this.videoInfo.Switching == 1) {
                this.currentCoachVideoElement.currentTime = (this.videoInfo.ExerciseVideoDuration - this.videoInfo.Duration) / 2;
            }
            else
                this.currentCoachVideoElement.currentTime = 0;
            if (this.currentCoachVideoElement.readyState > 0)
                this.currentCoachVideoElement.play();
            if (this.videoIndex < this.videoInfoList.Data.length - 1)
                this.coachPreviewAudioElement.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedAudioFile;
        }
        let jsonMsg = {
            "id": "PlayNextVideo",
            "isShowingCoach": this.bWithoutCoach,
            "videoIndex": this.videoIndex,
            "currentPos": this.curVideoPos,
            "memberMusicVolume": this.memberMusicVolume,
            "isShowingRecordedCoachVideo": this.bShowingRecordedCoachVideo
        };
        this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
        if (this.videoInfo.ControlName != "Welcome" && this.videoInfo.ControlName != "Custom Text & Image") {
            if (this.videoInfo.Stretch == 1) {
                this.audioBong.play();
            }
            else {
                if (this.videoInfo.ControlName != "Congratulations")
                    this.audioBoxingBell.play();
                else
                    this.audioBoxingBell6.play();
            }
        }
    }
    initializeElements() {
        this.tcanvas = document.createElement("canvas");
        //    this.tcanvas.crossOrigin ="anonymous";
        this.tc = this.tcanvas.getContext("2d");
        this.backCanvas = document.createElement("canvas");
        //  this.backCanvas.crossOrigin ="anonymous";
        this.backContext = this.backCanvas.getContext("2d");
        this.tbackCanvas = document.createElement("canvas");
        //    this.tbackCanvas.crossOrigin ="anonymous";
        this.tbackContext = this.tbackCanvas.getContext("2d");
        this.sbackCanvas = document.createElement("canvas");
        //  this.sbackCanvas.crossOrigin ="anonymous";
        this.sbackContext = this.sbackCanvas.getContext("2d");
        this.lrSignCanvas = document.createElement("canvas");
        //    this.lrSignCanvas.crossOrigin ="anonymous";
        this.lrSignContext = this.lrSignCanvas.getContext("2d");
        this.alSignCanvas = document.createElement("canvas");
        //  this.alSignCanvas.crossOrigin ="anonymous";
        this.alSignContext = this.alSignCanvas.getContext("2d");
        this.imgt = document.getElementById("top_of_video");
        this.imgb = document.getElementById("bottom_of_video");
        this.imgLeftRightSign = document.getElementById("left_right_sign");
        this.imgAlternateSign = document.getElementById("alternate_sign");
        this.imgLogo = document.getElementById("logo");
        this.imgCustom = document.getElementById("img_custom");
        this.imgWhiteLogo = document.getElementById("whitelogo");
        this.imgBottle = document.getElementById("img_bottle");
        this.videoCanvas = document.getElementById('trainVideoCanvas');
        this.videoCanvas.width = this.cw;
        this.videoCanvas.height = this.ch;
        this.videoCanvasContext = this.videoCanvas.getContext('2d');
        this.workoutVideoElement = document.getElementById('content-share-video');
        this.workoutNextVideoElement = document.getElementById('content-share-next-video');
        this.coachVideoElement1 = document.getElementById('CoachVideo');
        this.coachVideoElement2 = document.getElementById('NextCoachVideo');
        this.coachPreviewAudioElement = document.getElementById('CoachPreviewAudio');
        this.timerVideo = document.getElementById('TimerVideo');
        this.timerVideoForStretch = document.getElementById('TimerVideoForStretch');
        this.spinVideo = document.getElementById('SpinVideo');
        this.spinVideoForStretch = document.getElementById('SpinVideoForStretch');
        this.audioBoxingBell = document.getElementById('BoxingBellAudio');
        this.audioBoxingBell6 = document.getElementById('BoxingBellAudio6');
        this.audioSwooshLong = document.getElementById('SwooshLongAudio');
        this.audioSwooshShort = document.getElementById('SwooshShortAudio');
        this.audioWatchTick = document.getElementById('WatchTickAudio');
        this.audioBlip = document.getElementById('BlipAudio');
        this.audioBong = document.getElementById('BongAudio');
        this.audioStretchGong = document.getElementById('StretchGongAudio');
        this.audioStretchThump = document.getElementById('StretchThumpAudio');
        this.musicElement1 = document.getElementById('Music1');
        this.musicElement2 = document.getElementById('Music2');
        this.timerVideo.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Countdown5Blip.mp4";
        this.timerVideoForStretch.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Countdown5Stretch.mp4";
        this.spinVideo.src = "https://trainingroomfiles.s3.us-west-2.amazonaws.com/spin.mp4";
        this.spinVideoForStretch.src = "https://trainingroomfiles.s3.us-west-2.amazonaws.com/spin_stretch.mp4";
        this.audioBlip.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Blipx5.wav";
        this.audioBong.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Bong.wav";
        this.audioStretchGong.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/StretchGong.wav";
        this.audioStretchThump.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Thumpx5.wav";
        this.audioBoxingBell.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/BoxingBell-1.wav";
        this.audioBoxingBell6.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/BoxingBell-6.mp3";
        this.audioWatchTick.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/StopWatchTick.wav";
        this.audioSwooshLong.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/SwooshLong.wav";
        this.audioSwooshShort.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/SwooshShort.wav";
        this.tcanvas.width = this.cw;
        this.tcanvas.height = this.ch;
        this.tbackCanvas.width = this.cw;
        this.tbackCanvas.height = this.ch;
        this.backCanvas.width = this.cw;
        this.backCanvas.height = this.ch;
        this.sbackCanvas.width = this.cw;
        this.sbackCanvas.height = this.ch;
        this.alSignCanvas.width = 280;
        this.alSignCanvas.height = 280;
        this.lrSignCanvas.width = 280;
        this.lrSignCanvas.height = 280;
        this.prepareImageSign(this.lrSignContext, this.imgLeftRightSign, 280);
        this.prepareImageSign(this.alSignContext, this.imgAlternateSign, 280);
    }
    prepareImageSign(sbc, img, signWidth) {
        sbc.drawImage(img, 0, 0, signWidth, signWidth);
        // Grab the pixel data from the backing canvas
        var tidata = sbc.getImageData(0, 0, signWidth, signWidth);
        var tdata = tidata.data;
        // Loop through the pixels, turning them grayscale
        var xmax = signWidth, xmin = 0, ymax = signWidth, ymin = 0;
        var r = signWidth / 2 - 2;
        let px = (xmin + xmax) / 2;
        let py = (ymin + ymax) / 2;
        for (let i = 0; i < signWidth * signWidth; i++) {
            var x = i % signWidth;
            var y = ~~(i / signWidth);
            if ((px - x) * (px - x) + (py - y) * (py - y) > r * r) {
                tdata[i * 4 + 3] = 0;
                tdata[i * 4 + 0] = 0;
                tdata[i * 4 + 1] = 0;
                tdata[i * 4 + 2] = 0;
            }
        }
        tidata.data.set(tdata);
        sbc.clearRect(0, 0, signWidth, signWidth);
        sbc.putImageData(tidata, 0, 0);
    }
    startPlayingVideo() {
        this.isWorkoutOver = false;
        this.isWorkoutPaused = false;
        this.curVideoPos = 0;
        this.videoIndex = 0;
        this.bTimerActivated = false;
        this.videoInfo = this.videoInfoList.Data[this.videoIndex];
        if (this.videoElementIndex == this.videoIndex) {
            this.currentVideoElement = this.workoutVideoElement;
            this.workoutVideoElement.muted = true;
            if (this.videoInfo.Switching == 1) {
                this.workoutVideoElement.currentTime = (this.videoInfo.ExerciseVideoDuration - this.videoInfo.Duration) / 2;
            }
            else
                this.workoutVideoElement.currentTime = 0;
            this.workoutVideoElement.play();
        }
        if (this.bWithoutCoach) {
            this.currentCoachVideoElement = this.coachVideoElement1;
            if (this.currentCoachVideoElement.readyState > 0) {
                if (this.videoInfo.Switching == 1) {
                    this.currentCoachVideoElement.currentTime = (this.videoInfo.ExerciseVideoDuration - this.videoInfo.Duration) / 2;
                }
                else
                    this.currentCoachVideoElement.currentTime = 0;
                if (this.currentCoachVideoElement.readyState > 0)
                    this.currentCoachVideoElement.play();
            }
            this.coachVideoElement2.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedVideoFile;
            this.coachPreviewAudioElement.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedAudioFile;
        }
        if (this.videoIndex < this.videoInfoList.Data.length - 1 && this.videoInfo.ControlName != "Custom Text & Image") {
            if (this.videoInfoList.Data[this.videoIndex + 1].ControlName == "Custom Text & Image") {
                this.imgCustom.src = this.videoInfoList.Data[this.videoIndex + 1].CustomImage;
            }
        }
        if (this.videoInfo.ControlName != "Welcome" && this.videoInfo.ControlName != "Custom Text & Image") {
            if (this.videoInfo.MusicFile == this.musicElement1.src) {
                this.currentMusicElement = this.musicElement1;
                this.musicElement1.play();
            }
        }
        if (this.videoElementIndex != -1) {
            this.nextVideoElementIndex = this.findNextVideoIndex(this.videoElementIndex + 1);
            if (this.nextVideoElementIndex != -1) {
                this.workoutNextVideoElement.src = this.videoInfoList.Data[this.nextVideoElementIndex].VideoFile;
            }
            if (this.videoInfoList.HasOneSong != true) {
                let musicFile = null;
                if (this.musicElementIndex != -1 && this.videoInfoList.Data[this.musicElementIndex])
                    musicFile = this.videoInfoList.Data[this.musicElementIndex].MusicFile;
                this.nextMusicElementIndex = this.findNextMusicIndex(this.musicElementIndex + 1, musicFile);
                if (this.nextMusicElementIndex != -1)
                    this.musicElement2.src = this.videoInfoList.Data[this.nextMusicElementIndex].MusicFile;
            }
        }
        if ( /*!this.bVirtualCoachWorkout &&*/!this.bTrainerJoined && !this.bWithoutCoach) {
            this.bWithoutCoach = true;
            this.bShowingRecordedCoachVideo = true;
            this.coachVideoElement1.src = this.videoInfoList.Data[this.videoIndex].RecordedVideoFile;
            this.currentCoachVideoElement = this.coachVideoElement2;
            this.resetCanvasSize();
            console.log('switch to virtual coach mode');
        }
        let jsonMsg = {
            "id": "PlayNextVideo",
            "videoIndex": this.videoIndex,
            "currentPos": this.curVideoPos,
            "timerTick": this.bTimerActivated,
            "isShowingCoach": this.bWithoutCoach,
            "isShowingRecordedCoachVideo": this.bShowingRecordedCoachVideo,
            "timerTickPos": 0
        };
        this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
        this.mainProcess();
    }
    mainProcess() {
        if (!this.isWorkoutPaused) {
            this.curVideoPos += 30;
            if (!this.videoInfo.ControlName || this.videoInfo.ControlName == 'Water') {
                if (this.currentVideoElement.readyState > 0) {
                    if (this.videoInfo.Switching == 1) {
                        let curTime = this.currentVideoElement.currentTime - ((this.videoInfo.ExerciseVideoDuration - this.videoInfo.Duration) / 2);
                        if (curTime > 0 && Math.abs(this.curVideoPos - curTime * 1000) > 500)
                            this.curVideoPos = curTime * 1000;
                    }
                    else {
                        if (Math.abs(this.curVideoPos - this.currentVideoElement.currentTime * 1000) > 500)
                            this.curVideoPos = this.currentVideoElement.currentTime * 1000;
                    }
                }
            }
            if (this.bTimerActivated == true && (this.videoInfo.ControlName != 'Rest' || !this.bShowingNextVideoClip)) {
                if (this.videoInfo.Stretch == 1 && !this.timerVideoForStretch.paused && !this.timerVideoForStretch.ended) {
                    if (Math.abs(this.curVideoPos - this.timerVideoForStretch.currentTime * 1000 - this.videoInfo.Duration * 1000 + 5500) > 500)
                        this.curVideoPos = this.timerVideoForStretch.currentTime * 1000 + this.videoInfo.Duration * 1000 - 5500;
                }
                else if (this.videoInfo.Stretch != 1 && !this.timerVideo.paused && !this.timerVideo.ended) {
                    if (Math.abs(this.curVideoPos - this.timerVideo.currentTime * 1000 - this.videoInfo.Duration * 1000 + 5500) > 500)
                        this.curVideoPos = this.timerVideo.currentTime * 1000 + this.videoInfo.Duration * 1000 - 5500;
                }
            }
            if (this.curVideoPos >= this.videoInfo.Duration * 1000)
                this.playNextVideo();
            if (!this.isWorkoutOver) {
                if (this.videoInfo.ControlName != 'Congratulations' && ((this.curVideoPos >= this.videoInfo.Duration * 1000 - 10000 && this.videoInfo.ControlName != 'Rest') || (this.curVideoPos >= 3000 && this.videoInfo.ControlName == 'Rest')) && this.bShowingNextVideoClip == false) {
                    this.playNextVideoClip();
                }
                if (this.bWithoutCoach) {
                    if (this.videoIndex < this.videoInfoList.Data.length - 1 && ((this.curVideoPos >= this.videoInfo.Duration * 1000 - 10000 && this.videoInfo.ControlName != 'Rest') || (this.curVideoPos >= 3000 && this.videoInfo.ControlName == 'Rest')) && this.coachPreviewAudioElement.readyState > 0 && this.bPlayingCoachPreviewAudio == false) {
                        this.playPreviewAudio();
                    }
                }
                if (!this.videoInfo.ControlName && this.videoInfo.Switching == 1 && this.curVideoPos >= this.videoInfo.Duration * 1000 / 2 - 3000 && this.curVideoPos <= this.videoInfo.Duration * 1000 / 2 && !this.bSwitchActivated) {
                    this.bSwitchActivated = true;
                    if (this.videoInfo.Stretch == 1) {
                        this.spinVideoForStretch.currentTime = 0;
                        this.spinVideoForStretch.play();
                    }
                    else {
                        this.spinVideo.currentTime = 0;
                        this.spinVideo.play();
                    }
                }
                if (this.videoInfo.ControlName != 'Congratulations' && this.videoInfo.ControlName != 'Water' && !this.bTimerActivated && this.curVideoPos >= this.videoInfo.Duration * 1000 - 5500) {
                    if (this.videoInfo.Stretch == 1) {
                        this.timerVideoForStretch.currentTime = 0;
                        this.timerVideoForStretch.play();
                    }
                    else {
                        this.timerVideo.currentTime = 0;
                        this.timerVideo.play();
                    }
                    this.bTimerActivated = true;
                }
                this.drawOnCanvas();
            }
        }
        if (!this.isWorkoutOver) {
            this.mainProcessTimeoutHandler = new index_1.TimeoutScheduler(30);
            this.mainProcessTimeoutHandler.start(() => __awaiter(this, void 0, void 0, function* () {
                this.mainProcess();
            }));
        }
        else {
            if (this.currentMusicElement && !this.currentMusicElement.paused && !this.currentMusicElement.ended)
                this.currentMusicElement.pause();
        }
    }
    findNextVideoIndex(index) {
        for (let i = index; i < this.videoInfoList.Data.length; i++) {
            if (typeof this.videoInfoList.Data[i].VideoFile != 'undefined' && this.videoInfoList.Data[i].VideoFile) {
                return i;
            }
        }
        return -1;
    }
    findNextMusicIndex(index, songUrl) {
        for (let i = index; i < this.videoInfoList.Data.length; i++) {
            if (typeof this.videoInfoList.Data[i].MusicFile != 'undefined' && this.videoInfoList.Data[i].MusicFile && this.videoInfoList.Data[i].MusicFile != songUrl) {
                return i;
            }
        }
        return -1;
    }
    renderNextVideoTitle(c, w) {
        if (!this.strNextVideoTitle || !this.bShowingNextVideoClip) {
            return;
        }
        let textToDisplay = this.strNextVideoTitle.charAt(0) + this.strNextVideoTitle.slice(1);
        if (textToDisplay == "")
            return;
        c.font = '900 100px tenso';
        let measuredTextWidth = parseInt(c.measureText(textToDisplay).width);
        var x = 0;
        var y = 1830;
        let firstLine = "";
        let restLine = "";
        let offset_x = 0;
        if (measuredTextWidth > w - 180) {
            let lines = textToDisplay.split(' ');
            for (let i = 0; i < lines.length; i++) {
                let lineWidth = parseInt(c.measureText(firstLine + " " + lines[i]).width);
                if (lineWidth > w - 180) {
                    for (let j = i; j < lines.length; j++)
                        restLine += " " + lines[j];
                    break;
                }
                firstLine += " " + lines[i];
            }
            if (firstLine.length > 1)
                firstLine = firstLine.slice(1);
            if (restLine.length > 1)
                restLine = restLine.slice(1);
            measuredTextWidth = parseInt(c.measureText(firstLine).width);
            y = 1730;
        }
        c.globalAlpha = 1;
        if (this.videoInfo.ControlName == 'Rest') {
            if (this.curVideoPos >= 3000 && this.curVideoPos < 4000) {
                if (this.strNextVideoTitle != 'Almost Done') {
                    offset_x = (this.curVideoPos - 3000) / 1000.0 * 130;
                    c.globalAlpha = (this.curVideoPos - 3000) / 1000.0;
                }
                else {
                    offset_x = (this.curVideoPos - 3000) / 1000.0 * (w - measuredTextWidth) / 2;
                    c.globalAlpha = (this.curVideoPos - 3000) / 1000.0;
                }
            }
            else if (this.curVideoPos >= this.videoInfo.Duration * 1000 - 1000 && this.curVideoPos < this.videoInfo.Duration * 1000) {
                if (this.strNextVideoTitle != 'Almost Done') {
                    offset_x = 130;
                    c.globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
                }
                else {
                    offset_x = (w - measuredTextWidth) / 2;
                    c.globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
                }
            }
            else {
                if (this.strNextVideoTitle != 'Almost Done')
                    offset_x = 130;
                else
                    offset_x = (w - measuredTextWidth) / 2;
            }
        }
        else if (this.curVideoPos < this.videoInfo.Duration * 1000 - 10000)
            return;
        else if (this.curVideoPos >= this.videoInfo.Duration * 1000 - 10000 && this.curVideoPos < this.videoInfo.Duration * 1000 - 9000) {
            if (this.strNextVideoTitle != 'Almost Done') {
                offset_x = (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0 * 130;
                c.globalAlpha = (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0;
            }
            else {
                offset_x = (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0 * (w - measuredTextWidth) / 2;
                c.globalAlpha = (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0;
            }
        }
        else if (this.curVideoPos >= this.videoInfo.Duration * 1000 - 1000 && this.curVideoPos <= this.videoInfo.Duration * 1000) {
            if (this.strNextVideoTitle != 'Almost Done') {
                offset_x = 130;
                c.globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
            }
            else {
                offset_x = (w - measuredTextWidth) / 2;
                c.globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
            }
        }
        else {
            if (this.strNextVideoTitle != 'Almost Done')
                offset_x = 130;
            else
                offset_x = (w - measuredTextWidth) / 2;
        }
        if (this.videoInfo.ControlName == 'Rest') {
            c.fillStyle = "rgba(255,255,255,0.7)";
        }
        else {
            c.fillStyle = "#212121";
        }
        if (restLine != "") {
            c.fillText(firstLine, x + offset_x, y);
            c.fillText(restLine, x + offset_x, y + 100);
        }
        else
            c.fillText(textToDisplay, x + offset_x, y);
        if (this.strNextVideoTitle != 'Almost Done') {
            // c.font = 'bold 100px Impact';
            c.font = 'bold 100px tenso';
            c.rotate(-90 * Math.PI / 180);
            c.fillText('NEXT', -1835, offset_x - 30);
            c.rotate(90 * Math.PI / 180);
        }
    }
    renderVideoTitle(c, w) {
        var offset = 0;
        // var canvasWidth = 1080;
        var textToDisplay = "";
        // c.font = '100px Impact';
        c.font = '900 80px tenso';
        //CustomText
        if (this.bShowingRecordedCoachVideo && this.videoInfo.ControlName != 'Custom Text & Image' && this.videoInfo.CustomName) {
            textToDisplay = this.videoInfo.CustomName;
            //      console.log('here '+textToDisplay);
            var measuredTextWidth = parseInt(c.measureText(textToDisplay).width);
            if (measuredTextWidth > w - 50) {
                let lines = textToDisplay.split(' ');
                let firstLine = "";
                let restLine = "";
                for (let i = 0; i < lines.length; i++) {
                    let lineWidth = parseInt(c.measureText(firstLine + " " + lines[i]).width);
                    if (lineWidth > w - 50) {
                        for (let j = i; j < lines.length; j++)
                            restLine += " " + lines[j];
                        break;
                    }
                    firstLine += " " + lines[i];
                }
                if (firstLine.length > 1)
                    firstLine = firstLine.slice(1);
                if (restLine.length > 1)
                    restLine = restLine.slice(1);
                let firstLineWidth = parseInt(c.measureText(firstLine).width);
                let restLineWidth = parseInt(c.measureText(restLine).width);
                // let firstLineHeight = parseInt(c.measureText(firstLine).height);
                // let restLineHeight = parseInt(c.measureText(restLine).height);
                offset = 0;
                var x1 = (w - firstLineWidth) / 2;
                var x2 = (w - restLineWidth) / 2;
                var y = 80; // (250 - measuredTextHeight) / 2; 
                c.lineWidth = 2;
                // c.strokeStyle="black";
                c.globalAlpha = 1;
                c.fillStyle = "#28A745"; //"#FFFFFF";
                c.fillRect(w, 0, w, y + 100 + 15);
                c.globalAlpha = 1;
                c.fillStyle = "white";
                c.fillText(firstLine, w + x1 + offset, y);
                c.fillStyle = "white";
                c.fillText(restLine, w + x2 + offset, y + 100);
                // c.strokeText(restLine, x2+offset, y+100);
            }
            else {
                offset = 0;
                var x = (w - measuredTextWidth) / 2;
                offset = 0;
                var y = 80; // (250 - measuredTextHeight) / 2; 
                // c.strokeStyle="black";
                c.lineWidth = 2;
                c.globalAlpha = 1;
                c.fillStyle = "#28A745"; //"#FFFFFF";c.fillRect(0,0, w, restLineHeight);
                c.fillRect(w, 0, w, y + 15);
                c.globalAlpha = 1;
                c.fillStyle = "white";
                c.fillText(textToDisplay, w + x + offset, y);
                // c.strokeText(textToDisplay, x+offset, y);
            }
            c.globalAlpha = 1.0;
        }
        //
        if (this.videoInfo.ControlName == 'Logo' || this.videoInfo.ControlName == 'Water')
            return;
        c.font = '900 100px tenso';
        if (this.videoInfo.ControlName && this.videoInfo.ControlName != null) {
            if (this.videoInfo.ControlName == 'Custom Text & Image')
                textToDisplay = this.videoInfo.CustomName;
            else
                textToDisplay = this.videoInfo.ControlName;
        }
        else
            textToDisplay = this.videoInfo.ExerciseName;
        var measuredTextWidth = parseInt(c.measureText(textToDisplay).width);
        if (measuredTextWidth > w - 50) {
            let lines = textToDisplay.split(' ');
            let firstLine = "";
            let restLine = "";
            for (let i = 0; i < lines.length; i++) {
                let lineWidth = parseInt(c.measureText(firstLine + " " + lines[i]).width);
                if (lineWidth > w - 50) {
                    for (let j = i; j < lines.length; j++)
                        restLine += " " + lines[j];
                    break;
                }
                firstLine += " " + lines[i];
            }
            if (firstLine.length > 1)
                firstLine = firstLine.slice(1);
            if (restLine.length > 1)
                restLine = restLine.slice(1);
            let firstLineWidth = parseInt(c.measureText(firstLine).width);
            let restLineWidth = parseInt(c.measureText(restLine).width);
            // let firstLineHeight = parseInt(c.measureText(firstLine).height);
            // let restLineHeight = parseInt(c.measureText(restLine).height);
            if (this.videoInfo.ControlName == 'Custom Text & Image')
                offset = 0;
            else if (this.curVideoPos < 1000) {
                offset = 0 - (1000 - this.curVideoPos) / 1000.0 * (w / 2 - firstLineWidth / 2);
            }
            else if (this.curVideoPos > this.videoInfo.Duration * 1000 - 15000) {
                return;
            }
            else
                offset = 0;
            var x1 = (w - firstLineWidth) / 2;
            var x2 = (w - restLineWidth) / 2;
            var y = 80; // (250 - measuredTextHeight) / 2; 
            c.lineWidth = 3;
            // c.strokeStyle="black";
            if (this.curVideoPos < 10000)
                c.globalAlpha = 1;
            else
                c.globalAlpha = 0.3;
            c.fillStyle = "#DBA828"; //"#FFFFFF";
            c.fillRect(0, 0, w, y + 100 + 15);
            c.globalAlpha = 1;
            c.fillStyle = "white";
            c.fillText(firstLine, x1 + offset, y);
            c.fillStyle = "white";
            c.fillText(restLine, x2 + offset, y + 100);
            // c.strokeText(restLine, x2+offset, y+100);
        }
        else {
            if (this.videoInfo.ControlName == 'Custom Text & Image')
                offset = 0;
            else if (this.curVideoPos < 1000) {
                offset = 0 - (1000 - this.curVideoPos) / 1000.0 * (w / 2 - measuredTextWidth / 2);
            }
            else if (this.curVideoPos > this.videoInfo.Duration * 1000 - 15000 && this.videoInfo.ControlName != 'Rest' && this.videoInfo.ControlName != 'Welcome' && this.videoInfo.ControlName != 'Congratulations') {
                return;
            }
            var x = (w - measuredTextWidth) / 2;
            offset = 0;
            var y = 80; // (250 - measuredTextHeight) / 2; 
            // c.strokeStyle="black";
            c.lineWidth = 3;
            if (this.curVideoPos < 10000)
                c.globalAlpha = 1;
            else
                c.globalAlpha = 0.3;
            c.fillStyle = "#DBA828"; //"#FFFFFF";c.fillRect(0,0, w, restLineHeight);
            c.fillRect(0, 0, w, y + 15);
            c.globalAlpha = 1;
            c.fillStyle = "white";
            c.fillText(textToDisplay, x + offset, y);
            // c.strokeText(textToDisplay, x+offset, y);
        }
        c.globalAlpha = 1.0;
    }
    drawImageOnCanvas(img, bCoachArea) {
        var wrh = img.width / img.height;
        var newWidth = this.cw;
        var newHeight = newWidth / wrh;
        if (newHeight > this.ch) {
            newHeight = this.ch;
            newWidth = newHeight * wrh;
        }
        var xOffset = newWidth < this.cw ? ((this.cw - newWidth) / 2) : 0;
        var yOffset = newHeight < this.ch ? ((this.ch - newHeight) / 2) : 0;
        if (bCoachArea == true)
            this.videoCanvasContext.drawImage(img, this.cw + xOffset, yOffset, newWidth, newHeight);
        else
            this.videoCanvasContext.drawImage(img, xOffset, yOffset, newWidth, newHeight);
    }
    clearCanvas(position) {
        this.videoCanvasContext.globalAlpha = 1;
        this.videoCanvasContext.fillStyle = 'white';
        if (position == true) {
            if (this.videoInfo.ControlName == 'Rest')
                this.videoCanvasContext.fillStyle = 'black';
            else
                this.videoCanvasContext.fillStyle = 'white';
            this.videoCanvasContext.fillRect(0, 0, this.cw, this.ch);
        }
        else if (position == false) {
            this.videoCanvasContext.fillRect(this.cw, 0, this.cw, this.ch);
        }
        else {
            this.videoCanvasContext.fillRect(0, 0, this.videoCanvas.width, this.ch);
        }
    }
    drawOnCanvas() {
        if (this.isWorkoutOver)
            return;
        this.clearCanvas(true);
        if (this.videoInfo.ControlName == 'Welcome' || this.videoInfo.ControlName == 'Logo'
            || this.videoInfo.ControlName == 'Go Time' || this.videoInfo.ControlName == 'Rest') {
            if (this.videoInfo.ControlName != 'Rest')
                this.drawImageOnCanvas(this.imgLogo);
            else if (this.videoInfo.ControlName == 'Rest' && !this.bShowingNextVideoClip)
                this.drawImageOnCanvas(this.imgWhiteLogo);
        }
        else if (this.videoInfo.ControlName == 'Custom Text & Image') {
            this.drawImageOnCanvas(this.imgCustom);
        }
        else if (this.videoInfo.ControlName && this.videoInfo.ControlName != 'Water') {
            this.drawImageOnCanvas(this.imgLogo);
        }
        else {
            if (this.currentVideoElement.readyState > 0)
                this.videoCanvasContext.drawImage(this.currentVideoElement, 0, 0, this.cw, this.ch);
            else {
                this.videoCanvasContext.font = '900 30px tenso';
                this.videoCanvasContext.lineWidth = 1;
                let errText = "Video Load Problem";
                let measuredTextWidth = parseInt(this.videoCanvasContext.measureText(errText).width);
                this.videoCanvasContext.fillStyle = "grey";
                this.videoCanvasContext.fillText("Video Load Problem", (this.cw - measuredTextWidth) / 2, 1700);
            }
        }
        if (this.bWithoutCoach) {
            if (this.bShowingRecordedCoachVideo) {
                if (this.videoInfo.ControlName != 'Rest' || this.bShowingNextVideoClip != true)
                    this.clearCanvas(false);
                if (this.currentCoachVideoElement.readyState > 0)
                    this.videoCanvasContext.drawImage(this.currentCoachVideoElement, this.cw, 0, this.cw, this.ch);
                else if (this.videoInfo.ControlName == 'Rest' && this.bShowingNextVideoClip != true)
                    this.drawImageOnCanvas(this.imgLogo, true);
                else if (this.videoInfo.ControlName != 'Rest')
                    this.drawImageOnCanvas(this.imgLogo, true);
            }
        }
        this.renderVideoTitle(this.videoCanvasContext, this.cw);
        if (this.bShowingNextVideoClip) {
            this.renderNextVideoTitle(this.videoCanvasContext, this.cw);
            if (this.videoIndex + 1 == this.nextVideoElementIndex)
                this.drawNextVideoClip(this.videoCanvasContext, this.cw, this.ch, this.workoutNextVideoElement);
            else if (this.videoIndex + 1 == this.videoElementIndex)
                this.drawNextVideoClip(this.videoCanvasContext, this.cw, this.ch, this.workoutVideoElement);
        }
        if (this.videoInfo.Switching > 0) {
            // First, draw it into the backing canvas
            // Draw the pixels onto the visible canvas
            this.videoCanvasContext.globalAlpha = 1;
            if (this.videoInfo.Switching == 1)
                this.videoCanvasContext.drawImage(this.lrSignCanvas, this.cw - 300, this.ch - 350, 280, 280);
            else
                this.videoCanvasContext.drawImage(this.alSignCanvas, this.cw - 300, this.ch - 350, 280, 280);
        }
        if (this.bSwitchActivated && this.videoInfo.Switching == 1) {
            if ((this.videoInfo.Stretch != 1 && (this.spinVideo.paused || this.spinVideo.ended)) || (this.videoInfo.Stretch == 1 && (this.spinVideoForStretch.paused || this.spinVideoForStretch.ended))) {
            }
            else {
                // First, draw it into the backing canvas
                if (this.videoInfo.Stretch == 1)
                    this.sbackContext.drawImage(this.spinVideoForStretch, 0, 0, this.cw, this.ch);
                else
                    this.sbackContext.drawImage(this.spinVideo, 0, 0, this.cw, this.ch);
                // Grab the pixel data from the backing canvas
                var tidata = this.sbackContext.getImageData(0, 260, 1080, 1080);
                var tdata = tidata.data;
                // Loop through the pixels, turning them grayscale
                var xmax = 1080, xmin = 0, ymax = 1080, ymin = 0;
                var r = 540;
                var px = (xmin + xmax) / 2;
                var py = (ymin + ymax) / 2;
                for (i = 0; i < xmax * ymax; i++) {
                    var x = i % 1080;
                    var y = ~~(i / 1080);
                    if ((px - x) * (px - x) + (py - y) * (py - y) > r * r)
                        tdata[i * 4 + 3] = 0;
                    else {
                        if (tdata[i * 4] < 100 && tdata[i * 4 + 1] < 100 && tdata[i * 4 + 2] < 100)
                            tdata[i * 4 + 3] = 0;
                    }
                }
                tidata.data.set(tdata);
                this.tbackContext.clearRect(0, 0, this.cw, this.ch);
                this.tbackContext.putImageData(tidata, 0, 260);
                // Draw the pixels onto the visible canvas
                this.videoCanvasContext.globalAlpha = 0.7;
                if (this.videoInfo.Stretch == 1)
                    this.videoCanvasContext.drawImage(this.tbackCanvas, 0, 0, this.cw, this.ch);
                else
                    this.videoCanvasContext.drawImage(this.tbackCanvas, 0, 0, this.cw, this.ch);
            }
        }
        this.videoCanvasContext.drawImage(this.imgb, 0, 1860, (this.cw * this.curVideoPos / (this.videoInfo.Duration * 1000.0)), 60);
        if (this.bTimerActivated == true && ((this.videoInfo.Stretch == 1 && !this.timerVideoForStretch.ended) || (this.videoInfo.Stretch != 1 && !this.timerVideo.ended))) {
            if (this.videoInfo.Stretch == 1)
                this.tbackContext.drawImage(this.timerVideoForStretch, 0, 420, this.cw, this.cw);
            else
                this.tbackContext.drawImage(this.timerVideo, 0, 420, this.cw, this.cw);
            var tidata = this.tbackContext.getImageData(0, 0, this.cw, this.ch);
            var tdata = tidata.data;
            // Loop through the pixels, turning them grayscale
            var xmax = 0;
            let xmin = this.cw;
            let ymax = 0;
            let ymin = this.ch - 420;
            for (var i = 0; i < tdata.length; i += 4) {
                if (tdata[i] > 100 || tdata[i + 1] > 100 || tdata[i + 2] > 100) {
                    var x = (i / 4) % this.cw;
                    var y = ~~((i / 4) / this.cw);
                    if (xmin > x)
                        xmin = x;
                    if (xmax < x)
                        xmax = x;
                    if (ymin > y)
                        ymin = y;
                    if (ymax < y)
                        ymax = y;
                }
            }
            var r = xmax - xmin > ymax - ymin ? (ymax - ymin) / 2 : (xmax - xmin) / 2;
            r--;
            let px = (xmin + xmax) / 2;
            let py = (ymin + ymax) / 2;
            if (r > 0) {
                for (i = 0; i < this.cw * this.ch; i++) {
                    var x = i % this.cw;
                    var y = ~~(i / this.cw);
                    if ((px - x) * (px - x) + (py - y) * (py - y) > r * r)
                        tdata[i * 4 + 3] = 0;
                }
                tidata.data.set(tdata);
                this.tbackContext.clearRect(0, 0, this.cw, this.ch);
                this.tbackContext.putImageData(tidata, 0, 0);
                // Draw the pixels onto the visible canvas
                this.videoCanvasContext.globalAlpha = 0.5;
                if (this.videoInfo.Stretch == 1)
                    this.videoCanvasContext.drawImage(this.tbackCanvas, 0, 0, this.cw, this.ch);
                else
                    this.videoCanvasContext.drawImage(this.tbackCanvas, 0, 0, this.cw, this.ch);
            }
        }
    }
    drawNextVideoClip(c, w, h, nv) {
        if (this.strNextVideoTitle == 'Water')
            return;
        if (this.strNextVideoTitle == 'Almost Done')
            return;
        var globalAlpha = 1;
        var offset_x = w - w / 3 - 50;
        var offset_y = 50;
        var prevWidth = w / 3;
        var prevHeight = h / 3;
        if (this.videoInfo.ControlName == 'Rest') {
            if (nv.readyState > 0) {
                if (this.videoIndex < this.videoInfoList.Data.length - 1 && this.videoInfoList.Data[this.videoIndex + 1].Switching == 1) {
                    let curTime = nv.currentTime - ((this.videoInfoList.Data[this.videoIndex + 1].ExerciseVideoDuration - this.videoInfoList.Data[this.videoIndex + 1].Duration) / 2);
                    if (curTime > 0 && Math.abs(this.curVideoPos - curTime * 1000 - 3000) > 500)
                        this.curVideoPos = curTime * 1000 + 3000;
                }
                else {
                    if (Math.abs(this.curVideoPos - nv.currentTime * 1000 - 3000) > 500)
                        this.curVideoPos = nv.currentTime * 1000 + 3000;
                }
            }
            var textToDisplay = '';
            if (this.videoIndex < this.videoInfoList.Data.length - 1)
                textToDisplay = this.videoInfoList.Data[this.videoIndex + 1].ExerciseMemberNote;
            if (textToDisplay) {
                c.font = '900 60px tenso';
                var measuredTextWidth = parseInt(c.measureText(textToDisplay).width);
                if (measuredTextWidth > w - 50) {
                    let lines = textToDisplay.split(' ');
                    let firstLine = "";
                    let restLine = "";
                    for (let i = 0; i < lines.length; i++) {
                        let lineWidth = parseInt(c.measureText(firstLine + " " + lines[i]).width);
                        if (lineWidth > w - 50) {
                            for (let j = i; j < lines.length; j++)
                                restLine += " " + lines[j];
                            break;
                        }
                        firstLine += " " + lines[i];
                    }
                    if (firstLine.length > 1)
                        firstLine = firstLine.slice(1);
                    if (restLine.length > 1)
                        restLine = restLine.slice(1);
                    let firstLineWidth = parseInt(c.measureText(firstLine).width);
                    let restLineWidth = parseInt(c.measureText(restLine).width);
                    var x1 = (w - firstLineWidth) / 2;
                    var x2 = (w - restLineWidth) / 2;
                    var y = 450; // (250 - measuredTextHeight) / 2; 
                    c.lineWidth = 3;
                    c.globalAlpha = 1;
                    c.fillStyle = "white";
                    c.fillText(firstLine, x1, y);
                    c.fillStyle = "white";
                    c.fillText(restLine, x2, y + 100);
                    // c.strokeText(restLine, x2+offset, y+100);
                }
                else {
                    var x = (w - measuredTextWidth) / 2;
                    var y = 450; // (250 - measuredTextHeight) / 2; 
                    // c.strokeStyle="black";
                    c.lineWidth = 3;
                    if (this.curVideoPos < 10000)
                        c.globalAlpha = 1;
                    else
                        c.globalAlpha = 0.3;
                    c.fillStyle = "#DBA828"; //"#FFFFFF";c.fillRect(0,0, w, restLineHeight);
                    c.fillRect(0, 0, w, y + 15);
                    c.globalAlpha = 1;
                    c.fillStyle = "white";
                    c.fillText(textToDisplay, x, y);
                    // c.strokeText(textToDisplay, x+offset, y);
                }
                c.globalAlpha = 1.0;
            }
            if (this.bShowingRecordedCoachVideo) {
                this.clearCanvas(false);
                prevWidth = w;
                prevHeight = h;
                if (this.curVideoPos < 4000) {
                    globalAlpha = (this.curVideoPos - 3000) / 1000.0;
                    offset_x = w + (1 - (this.curVideoPos - 3000) / 1000.0) * w;
                    this.drawImageOnCanvas(this.imgLogo, true);
                }
                else if (this.curVideoPos > this.videoInfo.Duration * 1000 - 1000) {
                    globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
                    offset_x = w;
                }
                else {
                    globalAlpha = 1;
                    offset_x = w;
                }
                offset_y = 0;
            }
            else {
                prevWidth = w / 2;
                prevHeight = h / 2;
                if (this.curVideoPos < 4000) {
                    globalAlpha = (this.curVideoPos - 3000) / 1000.0;
                    offset_x = w / 4 + (1 - (this.curVideoPos - 3000) / 1000.0) * 3 * w / 4;
                }
                else if (this.curVideoPos > this.videoInfo.Duration * 1000 - 1000) {
                    globalAlpha = (this.videoInfo.Duration * 1000 - this.curVideoPos) / 1000.0;
                    offset_x = w / 4;
                }
                else {
                    globalAlpha = 1;
                    offset_x = w / 4;
                }
                offset_y = h / 4 - 100;
            }
        }
        else if (this.curVideoPos < this.videoInfo.Duration * 1000 - 10000) {
            return;
        }
        else if (this.curVideoPos >= this.videoInfo.Duration * 1000 - 10000 && this.curVideoPos < this.videoInfo.Duration * 1000 - 9000) {
            globalAlpha = (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0;
            offset_x += (1 - (this.curVideoPos - this.videoInfo.Duration * 1000 + 10000) / 1000.0) * prevWidth;
        }
        else {
            globalAlpha = 1;
        }
        c.globalAlpha = globalAlpha;
        c.beginPath();
        c.strokeStyle = "#DBA828";
        c.drawImage(nv, offset_x, offset_y, prevWidth, prevHeight);
        c.lineWidth = 16;
        c.rect(offset_x + 8, offset_y + 8, prevWidth - 16, prevHeight - 16);
        c.stroke();
        if (this.videoInfo.ControlName == 'Rest' && this.bShowingRecordedCoachVideo && this.curVideoPos > 4000) {
            c.globalAlpha = 0.8;
            c.font = '900 250px tenso';
            var nextSTR = "NEXT";
            var measuredNextWidth = parseInt(c.measureText(nextSTR).width);
            x = w + (w - measuredNextWidth) / 2;
            y = 200;
            c.lineWidth = 8;
            c.fillStyle = "#DBA828";
            c.fillText(nextSTR, x, y);
        }
    }
    getTrainerVideos() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(this.api_base_url + `Home/GetDynamicWorkoutDetail?WorkoutId=${this.workoutId}&ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`, {
                    method: 'POST',
                    mode: 'cors'
                });
                const json = yield response.json();
                console.log("workout:" + JSON.stringify(json));
                if (json.Status == "Success") {
                    this.videoInfoList = json;
                    for (let i = 0; i < this.videoInfoList.Data.length; i++) {
                        if (this.videoInfoList.Data[i].ControlName == 'Water') {
                            if (this.videoInfoList.Data[i].Duration == 30)
                                this.videoInfoList.Data[i].VideoFile = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Bottle30.mp4"; //res_path + '/Bottle30.mp4';
                            else if (this.videoInfoList.Data[i].Duration == 90)
                                this.videoInfoList.Data[i].VideoFile = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Bottle90.mp4"; //res_path + '/Bottle90.mp4';
                            else if (this.videoInfoList.Data[i].Duration == 120)
                                this.videoInfoList.Data[i].VideoFile = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Bottle120.mp4"; //res_path + '/Bottle120.mp4';
                            else {
                                this.videoInfoList.Data[i].VideoFile = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/Bottle60.mp4"; //res_path + '/Bottle60.mp4';
                                this.videoInfoList.Data[i].Duration = 60;
                            }
                            this.videoInfoList.Data[i].ExerciseName = '';
                        }
                    }
                    console.log("videoInfoList:" + JSON.stringify(this.videoInfoList));
                    if (this.videoInfoList && this.videoInfoList.Data) {
                        console.log("length:" + this.videoInfoList.Data.length);
                        this.videoIndex = 0;
                        if (this.videoInfoList.Data[0].CustomImage) {
                            this.imgCustom.src = this.videoInfoList.Data[0].CustomImage;
                        }
                        //preload first video for playing
                        this.videoElementIndex = this.findNextVideoIndex(this.videoIndex);
                        if (this.videoElementIndex != -1) {
                            this.workoutVideoElement.src = this.videoInfoList.Data[this.videoElementIndex].VideoFile;
                            this.workoutVideoElement.muted = true;
                        }
                        else
                            console.log('video is not existed.');
                        if (this.bWithoutCoach) {
                            this.coachVideoElement1.src = this.videoInfoList.Data[0].RecordedVideoFile;
                            this.coachPreviewAudioElement.src = this.videoInfoList.Data[1].RecordedAudioFile;
                        }
                        if (this.videoInfoList.HasOneSong == true) {
                            this.musicElementIndex = 0;
                            this.songUrl = this.musicElement1.src = this.videoInfoList.MusicFile;
                        }
                        else {
                            this.musicElementIndex = this.findNextMusicIndex(this.videoIndex, null);
                            if (this.musicElementIndex != -1)
                                this.songUrl = this.musicElement1.src = this.videoInfoList.Data[this.musicElementIndex].MusicFile;
                        }
                    }
                    else
                        console.log('videoInfoList is null');
                }
            }
            catch (error) {
                console.error(error.message);
                return;
            }
        });
    }
    stopBot() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${this.api_base_url}Home/stopBot?ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`, 
                //        `${WorkoutBotApp.BASE_URL}bothandler?botAction=stop&taskId=${this.taskId}`,
                {
                    method: 'POST',
                    mode: 'cors'
                });
                if (response.status == 200)
                    console.log('bot stopped successfully.');
            }
            catch (error) {
                console.error("error:" + error.message);
            }
        });
    }
    getClassScheduleDetail() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(this.api_base_url + `Home/GetClassScheduleDetail?WorkoutId=${this.workoutId}&ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`, {
                    method: 'POST',
                    mode: 'cors'
                });
                const json = yield response.json();
                console.log("workout time:" + JSON.stringify(json));
                if (json.Status != false) {
                    this.bVirtualCoachWorkout = json.WithoutCoach;
                    this.bWithoutCoach = json.WithoutCoach;
                    if (this.bWithoutCoach) {
                        this.videoCanvas.width = this.cw * 2;
                        this.videoCanvas.style.width = "648px";
                        this.bShowingRecordedCoachVideo = true;
                        this.coachVideoElement1.volume = this.coachVideoVolume;
                        this.coachVideoElement2.volume = this.coachVideoVolume;
                        this.musicElement1.volume = this.calcVolume(this.memberMusicVolume);
                        this.musicElement2.volume = this.musicElement1.volume;
                    }
                    this.taskId = json.TaskId;
                    let d = new Date(json.StartTime);
                    this.startTime = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
                    d = new Date(json.EndTime);
                    this.endTime = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
                }
            }
            catch (error) {
                console.error("error:" + error.message);
            }
        });
    }
    calcVolume(volume) {
        if (volume <= 0)
            return 0;
        if (volume >= 1)
            return 1;
        return parseFloat(Math.pow(2, (volume - 1) * 5).toFixed(2));
    }
    initParameters() {
        const meeting = new URL(window.location.href).searchParams.get('ClassScheduleId');
        if (meeting) {
            document.getElementById('inputMeeting').value = meeting;
            document.getElementById('inputName').focus();
        }
        else {
            document.getElementById('inputMeeting').focus();
        }
        this.defaultBrowserBehaviour = new index_1.DefaultBrowserBehavior();
    }
    startProcess() {
        new index_1.AsyncScheduler().start(() => __awaiter(this, void 0, void 0, function* () {
            console.log(new URL(window.location.href).searchParams);
            this.meeting = this.classScheduleId;
            this.role = '4'; //'Bot';
            this.name = '«Meeting Bot»';
            this.region = "us-east-1";
            let chimeMeetingId = '';
            this.initializeElements();
            yield this.getClassScheduleDetail();
            if (this.startTime == null) {
                document.getElementById('failed-meeting').innerText = `Invalid Class`;
                document.getElementById('failed-meeting-title').innerText = `Unable to fetch class details.`;
                document.getElementById('failed-meeting-text').innerText = `Cannot fetch valid class details from the server. Please check your class again.`;
                document.getElementById('failed-meeting-error').innerText =
                    "";
                this.switchToFlow('flow-failed-meeting');
                return;
            }
            yield this.getTrainerVideos();
            try {
                chimeMeetingId = yield this.authenticate();
            }
            catch (error) {
                document.getElementById('failed-meeting').innerText = `Meeting ID: ${this.meeting}`;
                document.getElementById('failed-meeting-error').innerText =
                    error.message;
                this.switchToFlow('flow-failed-meeting');
                return;
            }
            document.getElementById('meeting-id').innerText = `${this.meeting} (${this.region})`;
            document.getElementById('class-meeting-id').innerText = `${this.meeting} (${this.region})`;
            document.getElementById('chime-meeting-id').innerText = `${chimeMeetingId}`;
            document.getElementById('info-meeting').innerText = this.meeting;
            document.getElementById('info-name').innerText = this.name;
            yield this.join();
            this.drawImageOnCanvas(this.imgLogo);
            this.contentShareTypeChanged(ContentShareType.CanvasCapture);
            let now = new Date();
            let threeMinBeforeEndTime = new Date(this.endTime.getTime() + 60000 * 12);
            let fifteenMinAfterEndTime = new Date(this.endTime.getTime() + 60000 * 15);
            if (this.startTime.getTime() - now.getTime() >= 5000) {
                this.timeLeft = this.startTime.getTime(); // - now.getTime(); 
                console.log('workout will start in' + (this.startTime.getTime() - now.getTime()));
                new index_1.TimeoutScheduler(this.startTime.getTime() - now.getTime()).start(() => __awaiter(this, void 0, void 0, function* () {
                    this.timeLeft = 0;
                    this.startPlayingVideo(); //it should call exactly at workout start time.
                }));
            }
            else {
                this.timeLeft = 5000;
                console.log('workout will start in 5 seconds');
                new index_1.TimeoutScheduler(5000).start(() => __awaiter(this, void 0, void 0, function* () {
                    this.timeLeft = 0;
                    this.startPlayingVideo(); //it should call exactly at workout start time.
                }));
            }
            if (fifteenMinAfterEndTime.getTime() - now.getTime() >= 0) {
                new index_1.TimeoutScheduler(fifteenMinAfterEndTime.getTime() - now.getTime()).start(() => __awaiter(this, void 0, void 0, function* () {
                    let jsonMsg = {
                        "id": "MeetingClosed"
                    };
                    this.isWorkoutOver = true;
                    this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                    yield this.endMeeting();
                    yield this.stopBot();
                }));
            }
            if (threeMinBeforeEndTime.getTime() - now.getTime() >= 0) {
                new index_1.TimeoutScheduler(threeMinBeforeEndTime.getTime() - now.getTime()).start(() => __awaiter(this, void 0, void 0, function* () {
                    let jsonMsg = {
                        "id": "threeMinLeft"
                    };
                    this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                }));
            }
            this.displayButtonStates();
            this.switchToFlow('flow-meeting');
            new index_1.TimeoutScheduler(5000).start(() => __awaiter(this, void 0, void 0, function* () {
                yield this.updatePulseData();
            }));
        }));
    }
    getSupportedMediaRegions() {
        const supportedMediaRegions = [];
        const mediaRegion = (document.getElementById("inputRegion"));
        for (var i = 0; i < mediaRegion.length; i++) {
            supportedMediaRegions.push(mediaRegion.value);
        }
        return supportedMediaRegions;
    }
    getNearestMediaRegion() {
        return __awaiter(this, void 0, void 0, function* () {
            const nearestMediaRegionResponse = yield fetch(`https://nearest-media-region.l.chime.aws`, {
                method: 'GET',
            });
            const nearestMediaRegionJSON = yield nearestMediaRegionResponse.json();
            const nearestMediaRegion = nearestMediaRegionJSON.region;
            return nearestMediaRegion;
        });
    }
    setMediaRegion() {
        new index_1.AsyncScheduler().start(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const nearestMediaRegion = yield this.getNearestMediaRegion();
                if (nearestMediaRegion === '' || nearestMediaRegion === null) {
                    throw new Error('Nearest Media Region cannot be null or empty');
                }
                const supportedMediaRegions = this.getSupportedMediaRegions();
                if (supportedMediaRegions.indexOf(nearestMediaRegion) === -1) {
                    supportedMediaRegions.push(nearestMediaRegion);
                    const mediaRegionElement = (document.getElementById("inputRegion"));
                    const newMediaRegionOption = document.createElement("option");
                    newMediaRegionOption.value = nearestMediaRegion;
                    newMediaRegionOption.text = nearestMediaRegion + " (" + nearestMediaRegion + ")";
                    mediaRegionElement.add(newMediaRegionOption, null);
                }
                document.getElementById('inputRegion').value = nearestMediaRegion;
            }
            catch (error) {
                this.log('Default media region selected: ' + error.message);
            }
        }));
    }
    toggleButton(button, state) {
        if (state === 'on') {
            this.buttonStates[button] = true;
        }
        else if (state === 'off') {
            this.buttonStates[button] = false;
        }
        else {
            this.buttonStates[button] = !this.buttonStates[button];
        }
        this.displayButtonStates();
        return this.buttonStates[button];
    }
    isButtonOn(button) {
        return this.buttonStates[button];
    }
    displayButtonStates() {
        for (const button in this.buttonStates) {
            const element = document.getElementById(button);
            const drop = document.getElementById(`${button}-drop`);
            const on = this.buttonStates[button];
            element.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
            element.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
            element.firstElementChild.classList.add(on ? 'svg-active' : 'svg-inactive');
            element.firstElementChild.classList.remove(on ? 'svg-inactive' : 'svg-active');
            if (drop) {
                drop.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
                drop.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
            }
        }
    }
    showProgress(id) {
        document.getElementById(id).style.visibility = 'visible';
    }
    hideProgress(id) {
        document.getElementById(id).style.visibility = 'hidden';
    }
    switchToFlow(flow) {
        this.analyserNodeCallback = () => { };
        Array.from(document.getElementsByClassName('flow')).map(e => (e.style.display = 'none'));
        document.getElementById(flow).style.display = 'block';
    }
    audioInputsChanged(_freshAudioInputDeviceList) {
        this.populateAudioInputList();
    }
    videoInputsChanged(_freshVideoInputDeviceList) {
        this.populateVideoInputList();
    }
    audioOutputsChanged(_freshAudioOutputDeviceList) {
        this.populateAudioOutputList();
    }
    audioInputStreamEnded(deviceId) {
        this.log(`Current audio input stream from device id ${deviceId} ended.`);
    }
    videoInputStreamEnded(deviceId) {
        this.log(`Current video input stream from device id ${deviceId} ended.`);
    }
    estimatedDownlinkBandwidthLessThanRequired(estimatedDownlinkBandwidthKbps, requiredVideoDownlinkBandwidthKbps) {
        this.log(`Estimated downlink bandwidth is ${estimatedDownlinkBandwidthKbps} is less than required bandwidth for video ${requiredVideoDownlinkBandwidthKbps}`);
    }
    videoNotReceivingEnoughData(videoReceivingReports) {
        this.log(`One or more video streams are not receiving expected amounts of data ${JSON.stringify(videoReceivingReports)}`);
    }
    metricsDidReceive(clientMetricReport) {
        const metricReport = clientMetricReport.getObservableMetrics();
        if (typeof metricReport.availableSendBandwidth === 'number' && !isNaN(metricReport.availableSendBandwidth)) {
            document.getElementById('video-uplink-bandwidth').innerText =
                'Available Uplink Bandwidth: ' + String(metricReport.availableSendBandwidth / 1000) + ' Kbps';
        }
        else if (typeof metricReport.availableOutgoingBitrate === 'number' && !isNaN(metricReport.availableOutgoingBitrate)) {
            document.getElementById('video-uplink-bandwidth').innerText =
                'Available Uplink Bandwidth: ' + String(metricReport.availableOutgoingBitrate / 1000) + ' Kbps';
        }
        else {
            document.getElementById('video-uplink-bandwidth').innerText =
                'Available Uplink Bandwidth: Unknown';
        }
        if (typeof metricReport.availableReceiveBandwidth === 'number' && !isNaN(metricReport.availableReceiveBandwidth)) {
            document.getElementById('video-downlink-bandwidth').innerText =
                'Available Downlink Bandwidth: ' + String(metricReport.availableReceiveBandwidth / 1000) + ' Kbps';
        }
        else if (typeof metricReport.availableIncomingBitrate === 'number' && !isNaN(metricReport.availableIncomingBitrate)) {
            document.getElementById('video-downlink-bandwidth').innerText =
                'Available Downlink Bandwidth: ' + String(metricReport.availableIncomingBitrate / 1000) + ' Kbps';
        }
        else {
            document.getElementById('video-downlink-bandwidth').innerText =
                'Available Downlink Bandwidth: Unknown';
        }
    }
    createLogStream(configuration, pathname) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = JSON.stringify({
                meetingId: configuration.meetingId,
                attendeeId: configuration.credentials.attendeeId,
            });
            try {
                const response = yield fetch(`${WorkoutBotApp.BASE_URL}${pathname}`, {
                    method: 'POST',
                    body
                });
                if (response.status === 200) {
                    this.log('Log stream created');
                }
            }
            catch (error) {
                this.log(error.message);
            }
        });
    }
    eventDidReceive(name, attributes) {
        var _a, _b;
        this.log(`Received an event: ${JSON.stringify({ name, attributes })}`);
        const { meetingHistory } = attributes, otherAttributes = __rest(attributes, ["meetingHistory"]);
        switch (name) {
            case 'meetingEnded': {
                // Exclude the "meetingHistory" attribute for successful events.
                (_a = this.meetingEventPOSTLogger) === null || _a === void 0 ? void 0 : _a.info(JSON.stringify({
                    name,
                    attributes: otherAttributes
                }));
                this.stopBot();
                break;
            }
            case 'meetingStartRequested':
            case 'meetingStartSucceeded':
            case 'audioInputFailed':
            case 'videoInputFailed':
            case 'meetingStartFailed':
            case 'meetingFailed': {
                // Send the last 5 minutes of events.
                (_b = this.meetingEventPOSTLogger) === null || _b === void 0 ? void 0 : _b.info(JSON.stringify({
                    name,
                    attributes: Object.assign(Object.assign({}, otherAttributes), { meetingHistory: meetingHistory.filter(({ timestampMs }) => {
                            return Date.now() - timestampMs < WorkoutBotApp.MAX_MEETING_HISTORY_MS;
                        }) })
                }));
                break;
            }
        }
    }
    initializeMeetingSession(configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            let logger;
            const logLevel = index_1.LogLevel.INFO;
            const consoleLogger = logger = new index_1.ConsoleLogger('SDK', logLevel);
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                logger = consoleLogger;
            }
            else {
                yield Promise.all([
                    this.createLogStream(configuration, 'create_log_stream'),
                    this.createLogStream(configuration, 'create_browser_event_log_stream')
                ]);
                logger = new index_1.MultiLogger(consoleLogger, new index_1.MeetingSessionPOSTLogger('SDK', configuration, WorkoutBotApp.LOGGER_BATCH_SIZE, WorkoutBotApp.LOGGER_INTERVAL_MS, `${WorkoutBotApp.BASE_URL}logs`, logLevel));
                this.meetingEventPOSTLogger = new index_1.MeetingSessionPOSTLogger('SDKEvent', configuration, WorkoutBotApp.LOGGER_BATCH_SIZE, WorkoutBotApp.LOGGER_INTERVAL_MS, `${WorkoutBotApp.BASE_URL}log_meeting_event`, logLevel);
            }
            const deviceController = new index_1.DefaultDeviceController(logger, {
                enableWebAudio: this.enableWebAudio,
            });
            configuration.enableUnifiedPlanForChromiumBasedBrowsers = this.enableUnifiedPlanForChromiumBasedBrowsers;
            configuration.attendeePresenceTimeoutMs = 2400000;
            configuration.enableSimulcastForUnifiedPlanChromiumBasedBrowsers = this.enableSimulcast;
            this.meetingSession = new index_1.DefaultMeetingSession(configuration, logger, deviceController);
            this.audioVideo = this.meetingSession.audioVideo;
            // if ( this.isTester() ) {
            //   this.audioVideo.addDeviceChangeObserver(this);
            //   this.setupDeviceLabelTrigger();
            //   await this.populateAllDeviceLists();
            //   this.setupMuteHandler();
            //   this.setupCanUnmuteHandler();
            // }
            this.setupSubscribeToAttendeeIdPresenceHandler();
            this.setupDataMessage();
            // if ( this.isTester() ) {
            //   this.audioVideo.addObserver(this);
            //   this.audioVideo.addContentShareObserver(this);
            // }
        });
    }
    setClickHandler(elementId, f) {
        document.getElementById(elementId).addEventListener('click', () => {
            f();
        });
    }
    join() {
        return __awaiter(this, void 0, void 0, function* () {
            window.addEventListener('unhandledrejection', (event) => {
                this.log(event.reason);
            });
            //    await this.openAudioInputFromSelection();
            //    await this.openAudioOutputFromSelection();
            this.audioVideo.start();
        });
    }
    leave() {
        this.audioVideo.stop();
        this.roster = {};
    }
    updateProperty(obj, key, value) {
        if (value !== undefined && obj[key] !== value) {
            obj[key] = value;
        }
    }
    setupSubscribeToAttendeeIdPresenceHandler() {
        // const callback = async (
        //   _attendeeId: string,
        //   volume: number | null,
        //   _muted: boolean | null,
        //   _signalStrength: number | null
        // ): Promise<void> => {
        //   if ( !(window as any).setContentVolume )
        //     return;
        //   if (volume > 0.1 ){ 
        //     if ( this.memberMusicVolume > 0.1 )
        //       (window as any).setContentVolume(0.1, 0.05);
        //   } else {
        //     (window as any).setContentVolume(this.memberMusicVolume, 0.5);
        //   }
        // };
        const handler = (attendeeId, present, externalUserId, dropped) => {
            this.log(`${attendeeId} present = ${present} (${externalUserId})`);
            if (externalUserId.split('#')[1] == ROLE_TRAINER) {
                // if (!present)
                //   this.audioVideo.realtimeUnsubscribeFromVolumeIndicator(attendeeId, callback);
                // else
                //   this.audioVideo.realtimeSubscribeToVolumeIndicator(attendeeId,callback);
                //        this.bTrainerJoined = present;
                if (present == this.bTrainerJoined)
                    return;
                this.bTrainerJoined = present;
                if ( /*!this.bVirtualCoachWorkout &&*/!this.bPrivateChating) {
                    if (this.bTrainerJoined) {
                        this.bPrivateChating = false;
                        if (this.bWithoutCoach) {
                            console.log('trainer joined');
                            this.bWithoutCoach = false;
                            this.bShowingRecordedCoachVideo = false;
                            this.resetCanvasSize();
                            this.coachVideoElement1.pause();
                            this.coachVideoElement2.pause();
                            this.coachPreviewAudioElement.pause();
                            //should stop virtual coaching immediately
                            let jsonMsg = {
                                "status": "BWCMixedAudioStatus",
                                "isBWCMutedMemberMusic": false,
                                "isBWCMutedTrainer": true,
                                "memberMusicVolume": this.memberMusicVolume,
                                "trainerVolume": this.coachVideoVolume,
                                "isShowingCoach": false,
                                "isTrainerJoined": true
                            };
                            this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                        }
                    }
                    else {
                        if (!this.bWithoutCoach) {
                            if (this.videoIndex < this.videoInfoList.Data.length - 1) {
                                this.coachVideoElement1.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedVideoFile;
                            }
                            else {
                                this.coachVideoElement1.src = null;
                            }
                            this.currentCoachVideoElement = this.coachVideoElement2;
                        }
                    }
                }
            }
        };
        this.audioVideo.realtimeSubscribeToAttendeeIdPresence(handler);
    }
    dataMessageHandler(dataMessage) {
        if (!dataMessage.throttled) {
            const isSelf = dataMessage.senderAttendeeId === this.meetingSession.configuration.credentials.attendeeId;
            if (dataMessage.timestampMs <= this.lastReceivedMessageTimestamp) {
                return;
            }
            this.lastReceivedMessageTimestamp = dataMessage.timestampMs;
            const messageDiv = document.getElementById('receive-message');
            const messageNameSpan = document.createElement('div');
            messageNameSpan.classList.add('message-bubble-sender');
            messageNameSpan.innerText = (dataMessage.senderExternalUserId.split('#').slice(-1)[0]);
            const messageTextSpan = document.createElement('div');
            messageTextSpan.classList.add(isSelf ? 'message-bubble-self' : 'message-bubble-other');
            messageTextSpan.innerHTML = this.markdown.render(dataMessage.text()).replace(/[<]a /g, '<a target="_blank" ');
            const appendClass = (element, className) => {
                for (let i = 0; i < element.children.length; i++) {
                    const child = element.children[i];
                    child.classList.add(className);
                    appendClass(child, className);
                }
            };
            appendClass(messageTextSpan, 'markdown');
            if (this.lastMessageSender !== dataMessage.senderAttendeeId) {
                messageDiv.appendChild(messageNameSpan);
            }
            this.lastMessageSender = dataMessage.senderAttendeeId;
            messageDiv.appendChild(messageTextSpan);
            messageDiv.scrollTop = messageDiv.scrollHeight;
        }
        else {
            this.log('Message is throttled. Please resend');
        }
    }
    setupDataMessage() {
        this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC, (dataMessage) => {
            this.dataMessageHandler(dataMessage);
        });
        this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS, (dataMessage) => {
            if (dataMessage.text() != null && dataMessage.text() != '') {
                console.log(WorkoutBotApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS + ':' + dataMessage.text());
                const jsonData = JSON.parse(dataMessage.text());
                if (jsonData != null) {
                    if (jsonData.status == true) {
                        this.bPrivateChating = true;
                    }
                }
            }
        });
        this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE, (dataMessage) => __awaiter(this, void 0, void 0, function* () {
            // const videoFile = document.getElementById('content-share-video') as HTMLVideoElement;
            let currentTime = 0;
            if (dataMessage.text() == "Pause") {
                this.isWorkoutPaused = true;
                let jsonMsg = {
                    "id": "PauseVideo",
                    "videoIndex": this.videoIndex,
                    "currentPos": this.curVideoPos,
                    "timerTick": this.bTimerActivated,
                    "timerTickPos": currentTime
                };
                this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                if (this.currentVideoElement && !this.currentVideoElement.paused && !this.currentVideoElement.ended)
                    yield this.currentVideoElement.pause();
                if (this.currentMusicElement && !this.currentMusicElement.paused && !this.currentMusicElement.ended) {
                    yield this.currentMusicElement.pause();
                }
                if (this.bWithoutCoach) {
                    if (this.currentCoachVideoElement && !this.currentCoachVideoElement.paused && !this.currentCoachVideoElement.ended)
                        yield this.currentCoachVideoElement.pause();
                    if (this.coachPreviewAudioElement && !this.coachPreviewAudioElement.paused && !this.coachPreviewAudioElement.ended)
                        yield this.coachPreviewAudioElement.pause();
                }
                if (this.videoInfo.Stretch == 1) {
                    if (this.bTimerActivated && !this.timerVideoForStretch.paused && !this.timerVideoForStretch.ended)
                        yield this.timerVideoForStretch.pause();
                    currentTime = this.timerVideoForStretch.currentTime;
                }
                else {
                    if (this.bTimerActivated && !this.timerVideo.paused && !this.timerVideo.ended)
                        yield this.timerVideo.pause();
                    currentTime = this.timerVideo.currentTime;
                }
            }
            else if (dataMessage.text() == "Play") {
                this.isWorkoutPaused = false;
                let jsonMsg = {
                    "id": "PlayVideo",
                    "videoIndex": this.videoIndex,
                    "currentPos": this.curVideoPos,
                    "timerTick": this.bTimerActivated,
                    "timerTickPos": currentTime
                };
                this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                if (!this.videoInfo.ControlName) {
                    yield this.currentVideoElement.play();
                }
                if (this.currentMusicElement && this.currentMusicElement.src == this.videoInfo.MusicFile) {
                    try {
                        yield this.currentMusicElement.play();
                    }
                    catch (err) {
                        console.error(err.message);
                    }
                }
                if (this.bWithoutCoach) {
                    if (this.currentCoachVideoElement.readyState > 0) {
                        yield this.currentCoachVideoElement.play();
                    }
                    if (this.bPlayingCoachPreviewAudio && this.coachPreviewAudioElement.readyState > 0)
                        yield this.coachPreviewAudioElement.play();
                }
                if (this.bTimerActivated) {
                    if (this.videoInfo.Stretch == 1) {
                        yield this.timerVideoForStretch.play();
                        currentTime = this.timerVideoForStretch.currentTime;
                    }
                    else {
                        yield this.timerVideo.play();
                        currentTime = this.timerVideo.currentTime;
                    }
                }
            }
            else {
                const jsonData = JSON.parse(dataMessage.text());
                console.log("message:" + dataMessage.text());
                if (jsonData.id == "Play") {
                    this.isWorkoutPaused = true;
                    let jsonMsg = {
                        "id": "PauseVideo",
                        "videoIndex": this.videoIndex,
                        "currentPos": this.curVideoPos,
                        "timerTick": this.bTimerActivated,
                        "timerTickPos": currentTime
                    };
                    yield this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                    if (this.currentVideoElement && !this.currentVideoElement.paused && !this.currentVideoElement.ended)
                        yield this.currentVideoElement.pause();
                    if (this.currentMusicElement && !this.currentMusicElement.paused && !this.currentMusicElement.ended)
                        yield this.currentMusicElement.pause();
                    if (this.bWithoutCoach) {
                        if (this.currentCoachVideoElement && !this.currentCoachVideoElement.paused && !this.currentCoachVideoElement.ended)
                            yield this.currentCoachVideoElement.pause();
                        if (this.coachPreviewAudioElement && !this.coachPreviewAudioElement.paused && !this.coachPreviewAudioElement.ended)
                            yield this.coachPreviewAudioElement.pause();
                    }
                    try {
                        this.isWorkoutOver = true;
                        if (this.mainProcessTimeoutHandler)
                            this.mainProcessTimeoutHandler.stop();
                    }
                    catch (error) {
                        console.error(error.message);
                    }
                    new index_1.TimeoutScheduler(1000).start(() => __awaiter(this, void 0, void 0, function* () {
                        this.isWorkoutOver = false;
                        if (jsonData.videoIndex == 0) {
                            this.videoIndex = 0;
                            //preload first video for playing
                            this.videoElementIndex = this.findNextVideoIndex(this.videoIndex);
                            if (this.videoElementIndex != -1) {
                                this.workoutVideoElement.src = this.videoInfoList.Data[this.videoElementIndex].VideoFile;
                                this.workoutVideoElement.muted = true;
                            }
                            else
                                console.log('video is not existed.');
                            if (this.videoInfoList.HasOneSong == true) {
                                this.musicElementIndex = 0;
                                this.songUrl = this.musicElement1.src = this.videoInfoList.MusicFile;
                            }
                            else {
                                this.musicElementIndex = this.findNextMusicIndex(this.videoIndex, null);
                                if (this.musicElementIndex != -1)
                                    this.songUrl = this.musicElement1.src = this.videoInfoList.Data[this.musicElementIndex].MusicFile;
                            }
                            if (this.bWithoutCoach) {
                                this.coachVideoElement1.src = this.videoInfoList.Data[0].RecordedVideoFile;
                                this.coachPreviewAudioElement.src = this.videoInfoList.Data[1].RecordedAudioFile;
                            }
                            if (this.videoInfoList.Data[0].ControlName == "Custom Text & Image") {
                                this.imgCustom.src = this.videoInfoList.Data[0].CustomImage;
                            }
                            new index_1.TimeoutScheduler(1000).start(() => __awaiter(this, void 0, void 0, function* () {
                                this.startPlayingVideo();
                                let jsonMsg = {
                                    "id": "PlayVideo",
                                    "videoIndex": this.videoIndex,
                                    "currentPos": this.curVideoPos,
                                    "timerTick": this.bTimerActivated,
                                    "timerTickPos": currentTime
                                };
                                this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                            }));
                        }
                        else {
                            this.videoIndex = Number(jsonData.videoIndex) - 1;
                            this.videoElementIndex = this.findNextVideoIndex(Number(jsonData.videoIndex));
                            if (this.videoElementIndex != -1) {
                                this.workoutVideoElement.src = this.videoInfoList.Data[this.videoElementIndex].VideoFile;
                                this.workoutVideoElement.muted = true;
                            }
                            else
                                console.log('video is not existed.');
                            this.nextVideoElementIndex = this.videoIndex;
                            if (this.videoInfoList.HasOneSong == true) {
                                this.musicElementIndex = 0;
                                this.songUrl = this.musicElement1.src = this.videoInfoList.MusicFile;
                            }
                            else {
                                this.musicElementIndex = this.findNextMusicIndex(this.videoIndex + 1, null);
                                if (this.musicElementIndex != -1)
                                    this.songUrl = this.musicElement1.src = this.videoInfoList.Data[this.musicElementIndex].MusicFile;
                                this.currentMusicElement = this.musicElement2;
                            }
                            if (this.bWithoutCoach) {
                                if (this.videoIndex < this.videoInfoList.Data.length - 1)
                                    this.coachVideoElement1.src = this.videoInfoList.Data[this.videoIndex + 1].RecordedVideoFile;
                                else
                                    this.coachVideoElement1.src = null;
                                this.currentCoachVideoElement = this.coachVideoElement2;
                            }
                            if (this.videoIndex < this.videoInfoList.Data.length - 1 && this.videoInfoList.Data[this.videoIndex + 1].ControlName == "Custom Text & Image") {
                                this.imgCustom.src = this.videoInfoList.Data[this.videoIndex + 1].CustomImage;
                            }
                            new index_1.TimeoutScheduler(1000).start(() => __awaiter(this, void 0, void 0, function* () {
                                this.playNextVideo();
                                let jsonMsg = {
                                    "id": "PlayVideo",
                                    "videoIndex": this.videoIndex,
                                    "currentPos": this.curVideoPos,
                                    "timerTick": this.bTimerActivated,
                                    "timerTickPos": currentTime
                                };
                                this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
                                this.isWorkoutPaused = false;
                                this.mainProcess();
                            }));
                        }
                    }));
                }
            }
        }));
        this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_GET_VIDEO_STATUS, (dataMessage) => __awaiter(this, void 0, void 0, function* () {
            let currentTime = 0;
            if (!this.videoInfo)
                currentTime = 0;
            else if (this.videoInfo.Stretch == 1)
                currentTime = this.timerVideoForStretch.currentTime;
            else
                currentTime = this.timerVideo.currentTime;
            let jsonMsg = {
                "id": "VideoStatus",
                "videoIndex": this.videoIndex,
                "currentPos": this.curVideoPos,
                "isPaused": this.isWorkoutPaused,
                "isOver": this.isWorkoutOver,
                "timerTick": this.bTimerActivated,
                "timerTickPos": currentTime,
                "timeLeft": this.timeLeft,
                "isShowingCoach": this.bWithoutCoach,
                "memberMusicVolume": this.memberMusicVolume,
                "coachVideoVolume": this.coachVideoVolume,
                "isShowingRecordedCoachVideo": this.bShowingRecordedCoachVideo,
                "bPrivateChating": this.bPrivateChating
            };
            this.audioVideo.realtimeSendDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS);
        }));
        this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutBotApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, (dataMessage) => {
            if (dataMessage.text() != null && dataMessage.text() != '') {
                const jsonData = JSON.parse(dataMessage.text());
                console.log(WorkoutBotApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS + ':' + dataMessage.text());
                if (jsonData.status == "music") {
                    this.memberMusicVolume = parseFloat(jsonData.volume);
                    if (jsonData.isMutedMemberMusic == true) {
                        this.memberMusicVolume = 0;
                        //            (window as any).setContentVolume(0);
                    }
                    else {
                        //            (window as any).setContentVolume(this.memberMusicVolume);
                    }
                    this.musicElement1.volume = this.calcVolume(this.memberMusicVolume);
                    this.musicElement2.volume = this.musicElement1.volume;
                }
                else if (jsonData.status == "BWCMixedAudioStatus") {
                    this.memberMusicVolume = parseFloat(jsonData.memberMusicVolume);
                    this.coachVideoVolume = parseFloat(jsonData.trainerVolume);
                    this.bShowingRecordedCoachVideo = jsonData.isShowingCoach;
                    this.resetCanvasSize();
                    if (this.bShowingRecordedCoachVideo == false) {
                        this.coachVideoVolume = 0;
                    }
                    else {
                        if (jsonData.isBWCMutedTrainer == true)
                            this.coachVideoVolume = 0;
                    }
                    if (!this.coachPreviewAudioElement.paused && !this.coachPreviewAudioElement.ended) {
                        if (this.coachVideoVolume > 0.1) {
                            this.coachVideoElement1.volume = 0.1;
                            this.coachVideoElement2.volume = 0.1;
                        }
                        else {
                            this.coachVideoElement1.volume = this.coachVideoVolume;
                            this.coachVideoElement2.volume = this.coachVideoVolume;
                        }
                    }
                    else {
                        this.coachVideoElement1.volume = this.coachVideoVolume;
                        this.coachVideoElement2.volume = this.coachVideoVolume;
                    }
                    if (jsonData.isBWCMutedMemberMusic == true)
                        this.memberMusicVolume = 0;
                    this.musicElement1.volume = this.calcVolume(this.memberMusicVolume);
                    this.musicElement2.volume = this.musicElement1.volume;
                }
            }
        });
    }
    resetCanvasSize() {
        if (this.bShowingRecordedCoachVideo)
            this.videoCanvas.width = this.cw * 2;
        else
            this.videoCanvas.width = this.cw;
    }
    // eslint-disable-next-line
    joinMeeting() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(`${WorkoutBotApp.BASE_URL}join?title=${encodeURIComponent(this.meeting)}&name=${encodeURIComponent(this.name)}&region=${encodeURIComponent(this.region)}&role=${encodeURIComponent(this.role)}&customerId=${encodeURIComponent(this.customerId)}`, {
                method: 'POST',
            });
            const json = yield response.json();
            if (json.error) {
                throw new Error(`Server error: ${json.error}`);
            }
            return json;
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    endMeeting() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch(`${WorkoutBotApp.BASE_URL}end?title=${encodeURIComponent(this.meeting)}`, {
                method: 'POST',
            });
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAttendee(attendeeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(`${WorkoutBotApp.BASE_URL}attendee?title=${encodeURIComponent(this.meeting)}&attendee=${encodeURIComponent(attendeeId)}`);
            const json = yield response.json();
            if (json.error) {
                throw new Error(`Server error: ${json.error}`);
            }
            return json;
        });
    }
    populateDeviceList(elementId, genericName, devices, additionalOptions) {
        const list = document.getElementById(elementId);
        while (list.firstElementChild) {
            list.removeChild(list.firstElementChild);
        }
        for (let i = 0; i < devices.length; i++) {
            const option = document.createElement('option');
            list.appendChild(option);
            option.text = devices[i].label || `${genericName} ${i + 1}`;
            option.value = devices[i].deviceId;
        }
        if (additionalOptions.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.text = '──────────';
            list.appendChild(separator);
            for (const additionalOption of additionalOptions) {
                const option = document.createElement('option');
                list.appendChild(option);
                option.text = additionalOption;
                option.value = additionalOption;
            }
        }
        if (!list.firstElementChild) {
            const option = document.createElement('option');
            option.text = 'Device selection unavailable';
            list.appendChild(option);
        }
    }
    populateInMeetingDeviceList(elementId, genericName, devices, additionalOptions, callback) {
        const menu = document.getElementById(elementId);
        while (menu.firstElementChild) {
            menu.removeChild(menu.firstElementChild);
        }
        for (let i = 0; i < devices.length; i++) {
            this.createDropdownMenuItem(menu, devices[i].label || `${genericName} ${i + 1}`, () => {
                callback(devices[i].deviceId);
            });
        }
        if (additionalOptions.length > 0) {
            this.createDropdownMenuItem(menu, '──────────', () => { }).classList.add('text-center');
            for (const additionalOption of additionalOptions) {
                this.createDropdownMenuItem(menu, additionalOption, () => {
                    callback(additionalOption);
                }, `${elementId}-${additionalOption.replace(/\s/g, '-')}`);
            }
        }
        if (!menu.firstElementChild) {
            this.createDropdownMenuItem(menu, 'Device selection unavailable', () => { });
        }
    }
    createDropdownMenuItem(menu, title, clickHandler, id) {
        const button = document.createElement('button');
        menu.appendChild(button);
        button.innerText = title;
        button.classList.add('dropdown-item');
        this.updateProperty(button, 'id', id);
        button.addEventListener('click', () => {
            clickHandler();
        });
        return button;
    }
    populateAudioInputList() {
        return __awaiter(this, void 0, void 0, function* () {
            const genericName = 'Microphone';
            const additionalDevices = ['440 Hz'];
            //    const additionalDevices = ['None', '440 Hz'];
            this.populateDeviceList('audio-input', genericName, yield this.audioVideo.listAudioInputDevices(), additionalDevices);
            this.populateInMeetingDeviceList('dropdown-menu-microphone', genericName, yield this.audioVideo.listAudioInputDevices(), additionalDevices, (name) => __awaiter(this, void 0, void 0, function* () {
                const device = yield this.audioInputSelectionToDevice(name);
                yield this.audioVideo.chooseAudioInputDevice(device);
            }));
        });
    }
    populateVideoInputList() {
        return __awaiter(this, void 0, void 0, function* () {
            const genericName = 'Camera';
            //    const additionalDevices = ['None', 'Blue', 'SMPTE Color Bars'];
            const additionalDevices = ['SMPTE Color Bars'];
            this.populateDeviceList('video-input', genericName, yield this.audioVideo.listVideoInputDevices(), additionalDevices);
            this.populateInMeetingDeviceList('dropdown-menu-camera', genericName, yield this.audioVideo.listVideoInputDevices(), additionalDevices, (name) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.openVideoInputFromSelection(name, false);
                }
                catch (err) {
                    this.log('no video input device selected');
                }
            }));
            const cameras = yield this.audioVideo.listVideoInputDevices();
            this.cameraDeviceIds = cameras.map((deviceInfo) => {
                return deviceInfo.deviceId;
            });
        });
    }
    populateAudioOutputList() {
        return __awaiter(this, void 0, void 0, function* () {
            const genericName = 'Speaker';
            const additionalDevices = [];
            this.populateDeviceList('audio-output', genericName, yield this.audioVideo.listAudioOutputDevices(), additionalDevices);
            this.populateInMeetingDeviceList('dropdown-menu-speaker', genericName, yield this.audioVideo.listAudioOutputDevices(), additionalDevices, (name) => __awaiter(this, void 0, void 0, function* () {
                yield this.audioVideo.chooseAudioOutputDevice(name);
            }));
        });
    }
    openAudioInputFromSelection() {
        return __awaiter(this, void 0, void 0, function* () {
            const audioInput = document.getElementById('audio-input');
            const device = yield this.audioInputSelectionToDevice(audioInput.value);
            yield this.audioVideo.chooseAudioInputDevice(device);
            this.startAudioPreview();
        });
    }
    setAudioPreviewPercent(percent) {
        const audioPreview = document.getElementById('audio-preview');
        this.updateProperty(audioPreview.style, 'transitionDuration', '33ms');
        this.updateProperty(audioPreview.style, 'width', `${percent}%`);
        if (audioPreview.getAttribute('aria-valuenow') !== `${percent}`) {
            audioPreview.setAttribute('aria-valuenow', `${percent}`);
        }
    }
    startAudioPreview() {
        this.setAudioPreviewPercent(0);
        const analyserNode = this.audioVideo.createAnalyserNodeForAudioInput();
        if (!analyserNode) {
            return;
        }
        if (!analyserNode.getByteTimeDomainData) {
            document.getElementById('audio-preview').parentElement.style.visibility = 'hidden';
            return;
        }
        const data = new Uint8Array(analyserNode.fftSize);
        let frameIndex = 0;
        this.analyserNodeCallback = () => {
            if (frameIndex === 0) {
                analyserNode.getByteTimeDomainData(data);
                const lowest = 0.01;
                let max = lowest;
                for (const f of data) {
                    max = Math.max(max, (f - 128) / 128);
                }
                let normalized = (Math.log(lowest) - Math.log(max)) / Math.log(lowest);
                let percent = Math.min(Math.max(normalized * 100, 0), 100);
                this.setAudioPreviewPercent(percent);
            }
            frameIndex = (frameIndex + 1) % 2;
            requestAnimationFrame(this.analyserNodeCallback);
        };
        requestAnimationFrame(this.analyserNodeCallback);
    }
    openAudioOutputFromSelection() {
        return __awaiter(this, void 0, void 0, function* () {
            const audioOutput = document.getElementById('audio-output');
            yield this.audioVideo.chooseAudioOutputDevice(audioOutput.value);
            const audioMix = document.getElementById('meeting-audio');
            yield this.audioVideo.bindAudioElement(audioMix);
        });
    }
    openVideoInputFromSelection(selection, showPreview) {
        return __awaiter(this, void 0, void 0, function* () {
            if (selection) {
                this.selectedVideoInput = selection;
            }
            this.log(`Switching to: ${this.selectedVideoInput}`);
            const device = this.videoInputSelectionToDevice(this.selectedVideoInput);
            if (device === null) {
                if (showPreview) {
                    this.audioVideo.stopVideoPreviewForVideoInput(document.getElementById('video-preview'));
                }
                this.audioVideo.stopLocalVideoTile();
                this.toggleButton('button-camera', 'off');
                // choose video input null is redundant since we expect stopLocalVideoTile to clean up
                yield this.audioVideo.chooseVideoInputDevice(device);
                throw new Error('no video device selected');
            }
            yield this.audioVideo.chooseVideoInputDevice(device);
            if (showPreview) {
                this.audioVideo.startVideoPreviewForVideoInput(document.getElementById('video-preview'));
            }
        });
    }
    audioInputSelectionToDevice(value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRecorder()) {
                return null;
            }
            if (value === '440 Hz') {
                return index_1.DefaultDeviceController.synthesizeAudioDevice(440);
            }
            if (value === 'None') {
                return null;
            }
            return value;
        });
    }
    videoInputSelectionToDevice(value) {
        if (this.isRecorder()) {
            return null;
        }
        if (value === 'Blue') {
            return index_1.DefaultDeviceController.synthesizeVideoDevice('blue');
        }
        else if (value === 'SMPTE Color Bars') {
            return index_1.DefaultDeviceController.synthesizeVideoDevice('smpte');
        }
        else if (value === 'None') {
            return null;
        }
        return value;
    }
    contentShareTypeChanged(contentShareType, videoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isButtonOn('button-content-share')) {
                yield this.contentShareStop();
            }
            this.contentShareType = contentShareType;
            yield this.contentShareStart(videoUrl);
        });
    }
    contentShareStart(videoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            this.toggleButton('button-content-share');
            switch (this.contentShareType) {
                case ContentShareType.ScreenCapture:
                    this.audioVideo.startContentShareFromScreenCapture();
                    break;
                case ContentShareType.CanvasCapture:
                    console.log('starting share video:');
                    {
                        // @ts-ignore
                        this.mediaStream = this.videoCanvas.captureStream();
                        this.audioCtx = new AudioContext();
                        const sourceNodeTimerVideoForStretch = this.audioCtx.createMediaElementSource(this.timerVideoForStretch);
                        const sourceNodeTimerVideo = this.audioCtx.createMediaElementSource(this.timerVideo);
                        const sourceNodeSpinVideo = this.audioCtx.createMediaElementSource(this.spinVideo);
                        const sourceNodeSpinVideoForStretch = this.audioCtx.createMediaElementSource(this.spinVideoForStretch);
                        const sourceNodeCoachVideo1 = this.audioCtx.createMediaElementSource(this.coachVideoElement1);
                        const sourceNodeCoachVideo2 = this.audioCtx.createMediaElementSource(this.coachVideoElement2);
                        const sourceNodeCoachPreviewAudio = this.audioCtx.createMediaElementSource(this.coachPreviewAudioElement);
                        const sourceNodeBoxingBell = this.audioCtx.createMediaElementSource(this.audioBoxingBell);
                        const sourceNodeBoxingBell6 = this.audioCtx.createMediaElementSource(this.audioBoxingBell6);
                        const sourceNodeSwooshLong = this.audioCtx.createMediaElementSource(this.audioSwooshLong);
                        const sourceNodeSwooshShort = this.audioCtx.createMediaElementSource(this.audioSwooshShort);
                        const sourceNodeWatchTick = this.audioCtx.createMediaElementSource(this.audioWatchTick);
                        const sourceNodeBlip = this.audioCtx.createMediaElementSource(this.audioBlip);
                        const sourceNodeBong = this.audioCtx.createMediaElementSource(this.audioBong);
                        const sourceNodeStretchGong = this.audioCtx.createMediaElementSource(this.audioStretchGong);
                        const sourceNodeStretchThump = this.audioCtx.createMediaElementSource(this.audioStretchThump);
                        this.sourceNodeMusic1 = this.audioCtx.createMediaElementSource(this.musicElement1);
                        this.sourceNodeMusic2 = this.audioCtx.createMediaElementSource(this.musicElement2);
                        this.mixDestNode = new MediaStreamAudioDestinationNode(this.audioCtx, {
                            channelCount: 1,
                            channelCountMode: 'explicit',
                        });
                        // Mono.
                        this.combinedStream = new MediaStream(this.mediaStream.getVideoTracks());
                        this.combinedStream.addTrack(this.mixDestNode.stream.getAudioTracks()[0]);
                        // // Now we can add and remove as many source nodes as we like, and the destination node will mix them all into a single stream.
                        sourceNodeBoxingBell.connect(this.mixDestNode);
                        sourceNodeBoxingBell6.connect(this.mixDestNode);
                        sourceNodeSwooshLong.connect(this.mixDestNode);
                        sourceNodeSwooshShort.connect(this.mixDestNode);
                        sourceNodeWatchTick.connect(this.mixDestNode);
                        sourceNodeBlip.connect(this.mixDestNode);
                        sourceNodeBong.connect(this.mixDestNode);
                        sourceNodeStretchGong.connect(this.mixDestNode);
                        sourceNodeStretchThump.connect(this.mixDestNode);
                        sourceNodeTimerVideo.connect(this.mixDestNode);
                        sourceNodeTimerVideoForStretch.connect(this.mixDestNode);
                        sourceNodeSpinVideo.connect(this.mixDestNode);
                        sourceNodeSpinVideoForStretch.connect(this.mixDestNode);
                        sourceNodeCoachVideo1.connect(this.mixDestNode);
                        sourceNodeCoachVideo2.connect(this.mixDestNode);
                        sourceNodeCoachPreviewAudio.connect(this.mixDestNode);
                        this.sourceNodeMusic1.connect(this.mixDestNode);
                        this.sourceNodeMusic2.connect(this.mixDestNode);
                        const { stream, setVolume } = volume_1.addAudioVolumeControlToStream(this.combinedStream);
                        window.setContentVolume = setVolume;
                        this.audioVideo.startContentShare(stream);
                    }
                    break;
                case ContentShareType.VideoFile:
                    const videoFile = document.getElementById('content-share-video');
                    console.log('starting share video:' + videoUrl);
                    if (videoUrl) {
                        videoFile.src = videoUrl;
                    }
                    videoFile.muted = true;
                    yield videoFile.play();
                    let mediaStream;
                    if (this.defaultBrowserBehaviour.hasFirefoxWebRTC()) {
                        // @ts-ignore
                        mediaStream = videoFile.mozCaptureStream();
                    }
                    else {
                        // @ts-ignore
                        mediaStream = videoFile.captureStream();
                    }
                    this.audioVideo.startContentShare(mediaStream);
                    break;
            }
        });
    }
    contentShareStop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isButtonOn('button-pause-content-share')) {
                this.toggleButton('button-pause-content-share');
            }
            this.toggleButton('button-content-share');
            this.audioVideo.stopContentShare();
            if (this.contentShareType === ContentShareType.VideoFile) {
                const videoFile = document.getElementById('content-share-video');
                videoFile.pause();
                videoFile.style.display = 'none';
            }
        });
    }
    isRecorder() {
        return (new URL(window.location.href).searchParams.get('record')) === 'true';
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            let joinInfo = (yield this.joinMeeting()).JoinInfo;
            const configuration = new index_1.MeetingSessionConfiguration(joinInfo.Meeting, joinInfo.Attendee);
            yield this.initializeMeetingSession(configuration);
            const url = new URL(window.location.href);
            url.searchParams.set('ClassScheduleId', this.meeting);
            history.replaceState({}, `${this.meeting}`, url.toString());
            return configuration.meetingId;
        });
    }
    log(str) {
        console.log(`[DEMO] ${str}`);
    }
    audioVideoDidStartConnecting(reconnecting) {
        this.log(`session connecting. reconnecting: ${reconnecting}`);
    }
    audioVideoDidStart() {
        this.log('session started');
    }
    audioVideoDidStop(sessionStatus) {
        this.log(`session stopped from ${JSON.stringify(sessionStatus)}`);
        if (sessionStatus.statusCode() === index_1.MeetingSessionStatusCode.AudioCallEnded) {
            this.log(`meeting ended`);
            // @ts-ignore
            //window.location = window.location.pathname;
        }
        else if (sessionStatus.statusCode() === index_1.MeetingSessionStatusCode.Left) {
            this.log('left meeting');
            // @ts-ignore
            // window.location = window.location.pathname;
        }
    }
    videoTileDidUpdate(tileState) {
        this.log(`video tile updated: ${JSON.stringify(tileState, null, '  ')}`);
        if (!tileState.boundAttendeeId) {
            return;
        }
        if (tileState.boundAttendeeId.split('#')[1] == "content") {
            debugger;
            if (tileState.paused == true) {
                this.workoutVideoElement.pause();
            }
            else {
                this.workoutVideoElement.play();
            }
        }
        else {
            const tileIndex = tileState.localTile
                ? 16
                : this.tileOrganizer.acquireTileIndex(tileState.tileId);
            this.tileIndexToTileId[tileIndex] = tileState.tileId;
            this.tileIdToTileIndex[tileState.tileId] = tileIndex;
        }
    }
    videoTileWasRemoved(tileId) {
        const tileIndex = this.tileOrganizer.releaseTileIndex(tileId);
        this.log(`video tileId removed: ${tileId} from tile-${tileIndex}`);
    }
    videoAvailabilityDidChange(availability) {
        this.canStartLocalVideo = availability.canStartLocalVideo;
        this.log(`video availability changed: canStartLocalVideo  ${availability.canStartLocalVideo}`);
    }
    tileIdForAttendeeId(attendeeId) {
        for (const tile of this.audioVideo.getAllVideoTiles()) {
            const state = tile.state();
            if (state.boundAttendeeId === attendeeId) {
                return state.tileId;
            }
        }
        return null;
    }
    findContentTileId() {
        for (const tile of this.audioVideo.getAllVideoTiles()) {
            const state = tile.state();
            if (state.isContent) {
                return state.tileId;
            }
        }
        return null;
    }
    activeTileId() {
        let contentTileId = this.findContentTileId();
        if (contentTileId !== null) {
            return contentTileId;
        }
        for (const attendeeId in this.roster) {
            if (this.roster[attendeeId].active) {
                return this.tileIdForAttendeeId(attendeeId);
            }
        }
        return null;
    }
    availablelTileSize() {
        return this.tileOrganizer.remoteTileCount +
            (this.audioVideo.hasStartedLocalVideoTile() ? 1 : 0);
    }
    localTileId() {
        return this.audioVideo.hasStartedLocalVideoTile() ? this.audioVideo.getLocalVideoTile().state().tileId : null;
    }
    visibleTileIndices() {
        const tileKeys = Object.keys(this.tileOrganizer.tiles);
        const tiles = tileKeys.map(tileId => parseInt(tileId));
        return tiles;
    }
    setUpVideoTileElementResizer() {
        for (let i = 0; i <= TileOrganizer.MAX_TILES; i++) {
            const videoElem = document.getElementById(`video-${i}`);
            videoElem.onresize = () => {
                if (videoElem.videoHeight > videoElem.videoWidth) {
                    // portrait mode
                    videoElem.style.objectFit = 'contain';
                    this.log(`video-${i} changed to portrait mode resolution ${videoElem.videoWidth}x${videoElem.videoHeight}`);
                }
                else {
                    videoElem.style.objectFit = 'cover';
                }
            };
        }
    }
    allowMaxContentShare() {
        const allowed = (new URL(window.location.href).searchParams.get('max-content-share')) === 'true';
        if (allowed) {
            return true;
        }
        return false;
    }
    connectionDidBecomePoor() {
        this.log('connection is poor');
    }
    connectionDidSuggestStopVideo() {
        this.log('suggest turning the video off');
    }
    connectionDidBecomeGood() {
        this.log('connection is good now');
    }
    videoSendDidBecomeUnavailable() {
        this.log('sending video is not available');
    }
    contentShareDidStart() {
        this.log('content share started.');
    }
    contentShareDidStop() {
        this.log('content share stopped.');
        if (this.isButtonOn('button-content-share')) {
            this.buttonStates['button-content-share'] = false;
            this.buttonStates['button-pause-content-share'] = false;
            this.displayButtonStates();
        }
    }
    contentShareDidPause() {
        this.log('content share paused.');
    }
    contentShareDidUnpause() {
        this.log(`content share unpaused.`);
    }
}
exports.WorkoutBotApp = WorkoutBotApp;
WorkoutBotApp.BASE_URL = [location.protocol, '//', location.host, location.pathname.replace(/\/*$/, '/').replace('/bot', '')].join('');
WorkoutBotApp.LOGGER_BATCH_SIZE = 85;
WorkoutBotApp.LOGGER_INTERVAL_MS = 2000;
WorkoutBotApp.MAX_MEETING_HISTORY_MS = 5 * 60 * 1000;
WorkoutBotApp.DATA_MESSAGE_TOPIC = "chat";
WorkoutBotApp.DATA_MESSAGE_LIFETIME_MS = 300000;
WorkoutBotApp.SIGNAL_MESSAGE_LIFETIME_MS = 2000;
WorkoutBotApp.DataMessageTopicJoinClass = "Join";
WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE = "video_pause";
WorkoutBotApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS = "video_status";
WorkoutBotApp.DATA_MESSAGE_TOPIC_GET_VIDEO_STATUS = "get_video_status";
WorkoutBotApp.DATA_MESSAGE_TOPIC_PULSE_DATA = "pulse_data";
WorkoutBotApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS = "memberMusicStatus";
WorkoutBotApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS = "oneByOneChatStatus";
window.addEventListener('load', () => {
    new WorkoutBotApp();
});
//# sourceMappingURL=bot.js.map