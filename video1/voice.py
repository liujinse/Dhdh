"""Generate voice lines (offline sherpa-onnx VITS zh model)."""
import sys, json, sherpa_onnx, soundfile as sf
d = sys.argv[1].rstrip('/') + '/'
out = sys.argv[2]
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d+'vits-zh-hf-fanchen-C.onnx',
        lexicon=d+'lexicon.txt', tokens=d+'tokens.txt', dict_dir=d+'dict'), num_threads=8),
    rule_fsts=d+'phone.fst,'+d+'date.fst,'+d+'number.fst')
tts = sherpa_onnx.OfflineTts(cfg)
LINES = json.load(open(__file__.replace('voice.py', 'lines.json'), encoding='utf-8'))
for i, ln in enumerate(LINES):
    a = tts.generate(ln['say'], sid=ln['sid'], speed=ln.get('speed', 1.0))
    sf.write(f'{out}/line{i}.wav', a.samples, a.sample_rate)
    print(i, ln['who'], round(len(a.samples)/a.sample_rate, 2))
