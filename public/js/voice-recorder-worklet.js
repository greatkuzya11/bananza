class BananzaVoiceRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel && channel.length) {
      this.port.postMessage(channel.slice());
    }
    return true;
  }
}

registerProcessor('bananza-voice-recorder', BananzaVoiceRecorderProcessor);
