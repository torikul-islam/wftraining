import {
  SingleNodeAudioTransformDevice,
} from '../../../../src/index';
export class VolumeTransformDevice extends SingleNodeAudioTransformDevice<GainNode> {
  private volume: number = 1.0; // So we can adjust volume prior to creating the node.

  async createSingleAudioNode(context: AudioContext): Promise<GainNode> {
    const node = context.createGain();

    // Start at whatever volume the user already picked for this device, whether
    // or not we were connected to the audio graph.
    node.gain.setValueAtTime(this.volume, context.currentTime);
    return node;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.node) {
      this.node.gain.linearRampToValueAtTime(volume, this.node.context.currentTime + 0.25);
    }
  }
}