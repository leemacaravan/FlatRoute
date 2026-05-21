const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

export function speak(text) {
  if (!synth) return
  // Cancel any in-progress speech so we don't queue up stale announcements
  synth.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.05
  utt.volume = 1
  synth.speak(utt)
}

export function cancelSpeech() {
  synth?.cancel()
}

export function voiceSupported() {
  return !!synth
}
