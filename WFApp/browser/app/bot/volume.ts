import { DefaultDeviceController }  from '../../../../src/index';

export function addAudioVolumeControlToStream(inputStream: MediaStream): { stream: MediaStream, setVolume?: (volume: number) => void } {
  // Handle the case where this is a silent screen share: just
  // return the input stream with no volume adjustment.
  if (!inputStream.getAudioTracks().length) {
    return { stream: inputStream };
  }

  // This is the Web Audio context to use for our audio graph.
  const audioContext: AudioContext = DefaultDeviceController.getAudioContext();

  // This node applies a gain to its input. Start it at 1.0.
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);

  // This function lets you adjust the volume. It uses a quick linear ramp
  // to avoid jarring volume changes.
  const setVolume = (to: number, rampSec = 0.25): void => {
    gainNode.gain.linearRampToValueAtTime(to, audioContext.currentTime + rampSec);
  }

  // Now apply the node to the stream using the helper.
  const stream = addAudioNodeToCombinedStream(audioContext, gainNode, inputStream);
  return {
    setVolume,
    stream,
  };
}

function addAudioNodeToCombinedStream(context: AudioContext, node: AudioNode, inputStream: MediaStream): MediaStream {
  const audioTracks = inputStream.getAudioTracks();

  // This is a new stream containing just the audio tracks from the input.
  const audioInput = new MediaStream(audioTracks);

  // These are the input and output nodes in the audio graph.
  const source = context.createMediaStreamSource(audioInput);
  const destination = context.createMediaStreamDestination();

  source.connect(node);
  node.connect(destination);

  // Now create a new stream consisting of the gain-adjusted audio stream
  // and the video tracks from the original input.
  const combinedStream = new MediaStream(destination.stream);
  for (const v of inputStream.getVideoTracks()) {
    combinedStream.addTrack(v);
  }

  return combinedStream;
}