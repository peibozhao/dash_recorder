import React, {Component} from 'react';
import PropTypes from 'prop-types';

(function (window) {
    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    var HZRecorder = function (stream) {
        var context = new (window.webkitAudioContext || window.AudioContext)();
        var audioInput = context.createMediaStreamSource(stream);
        var createScript = context.createScriptProcessor || context.createJavaScriptNode;
        var recordnode = createScript.apply(context, [1024, 1, 1]);

        var audioData = {
            size: 0
            , buffer: []
            , inputSampleRate: context.sampleRate
            , outputSampleRate: 16000
            , input: function (data) {
                this.buffer.push(new Float32Array(data));
                this.size += data.length;
            }
            , resample: function () {
                var data = new Float32Array(this.size);
                var offset = 0;
                for (var i = 0; i < this.buffer.length; i++) {
                    data.set(this.buffer[i], offset);
                    offset += this.buffer[i].length;
                }
                var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
                var length = data.length / compression;
                var result = new Float32Array(length);
                var index = 0, j = 0;
                while (index < length) {
                    result[index] = data[j];
                    j += compression;
                    index++;
                }
                return result;
            } , getPCM: function() {
                var bytes = this.resample();
                return bytes;
            } , getWAV: function () {
                var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
                var sampleBits = 16;
                var bytes = this.resample();
                var dataLength = bytes.length * (sampleBits / 8);
                var buffer = new ArrayBuffer(44 + dataLength);
                var data = new DataView(buffer);
                var channelCount = 1;

                var writeString = function (str) {
                    for (var i = 0; i < str.length; i++) {
                        data.setUint8(offset + i, str.charCodeAt(i));
                    }
                }

                var offset = 0;
                writeString('RIFF'); offset += 4;
                data.setUint32(offset, 36 + dataLength, true); offset += 4;
                writeString('WAVE'); offset += 4;
                writeString('fmt '); offset += 4;
                data.setUint32(offset, 16, true); offset += 4;
                data.setUint16(offset, 1, true); offset += 2;
                data.setUint16(offset, channelCount, true); offset += 2;
                data.setUint32(offset, sampleRate, true); offset += 4;
                data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
                data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
                data.setUint16(offset, sampleBits, true); offset += 2;
                writeString('data'); offset += 4;
                data.setUint32(offset, dataLength, true); offset += 4;
                for (var i = 0; i < bytes.length; i++, offset += 2) {
                    var s = Math.max(-1, Math.min(1, bytes[i]));
                    data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }

                return new Blob([data], { type: 'audio/wav' });
            }
        };

        this.start = function () {
            audioInput.connect(recordnode);
            recordnode.connect(context.destination);
        }

        this.stop = function () {
            audioInput.disconnect();
            recordnode.disconnect();
        }

        this.getPCM = function() {
            return audioData.getPCM();
        }

        this.getBlob = function () {
            return audioData.getWAV();
        }

        this.play = function (audio) {
            audio.src = window.URL.createObjectURL(this.getBlob());
        }

        recordnode.onaudioprocess = function (e) {
            audioData.input(e.inputBuffer.getChannelData(0));
        }

    };

    window.throwError = function (message) {
        alert(message);
        throw new function () { this.toString = function () { return message; } }
    }

    window.HZRecorder = HZRecorder;

})(window);

var recorder;
var stream;

export default class DashRecorder extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        console.log(this.props)
        return (
            <div id={this.props.id}>
                <button margin='10' onClick={this.record.bind(this)}> record </button>
                <button margin='10' onClick={this.stop.bind(this)}> stop </button>
                <button margin='10' onClick={this.play.bind(this)}> play </button>
                <audio controls autoPlay></audio>
            </div>
        );
    }

    record() {
        if (navigator.getUserMedia) {
            navigator.getUserMedia({ audio: true }
                , function (s) {
                    stream = s;
                    var rec = new HZRecorder(stream);
                    recorder = rec;
                    recorder.start();
                }
                , function (error) {
                    switch (error.code || error.name) {
                        case 'PERMISSION_DENIED':
                        case 'PermissionDeniedError':
                            throwError('用户拒绝提供信息。');
                            break;
                        case 'NOT_SUPPORTED_ERROR':
                        case 'NotSupportedError':
                            throwError('浏览器不支持硬件设备。');
                            break;
                        case 'MANDATORY_UNSATISFIED_ERROR':
                        case 'MandatoryUnsatisfiedError':
                            throwError('无法发现指定的硬件设备。');
                            break;
                        default:
                            throwError('无法打开麦克风。异常信息:' + (error.code || error.name));
                            break;
                    }
                });
        } else {
            throwError('当前浏览器不支持录音功能。'); return;
        }
    }

    stop() {
        recorder.stop();
        var pcm_data = recorder.getPCM();
        var pcm_arr = [];
        for (var i = 0; i < pcm_data.length; i++) {
            pcm_arr.push(pcm_data[i])
        }
        this.props.setProps({buffer: pcm_arr})
        stream.getTracks().forEach(function(track) {
            track.stop();
        });
    }

    play() {
        this.stop();
        var audio = document.querySelector('audio');
        recorder.play(audio);
    }
}

DashRecorder.defaultProps = {
    buffer: []
};

DashRecorder.propTypes = {

    id: PropTypes.string,

    buffer: PropTypes.array,

};
