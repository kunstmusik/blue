"""Original synthetic Csound workloads for the BlueMixer opcode review.

No Blue or Csound implementation source is copied. Run with Python 3.
Timings use child user+system CPU, including compilation/startup; no audio I/O.
"""
import argparse
import array
import json
import pathlib
import random
import resource
import statistics
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent


def workload(name, strips=64):
    init = ['kA init 0.73', 'kB init 0.29', 'kC init 0.17', 'kD init 0.81',
            'kSend init 0.63', 'kGate init 0.71']
    body = ['ainL poscil 0.001, 317', 'ainR poscil 0.001, 751']
    if name.startswith('fade_'):
        body += ['aEnv linseg 0.1, p3, 0.9', 'aInv = 1 - aEnv']
    outputs = []
    for i in range(strips):
        l, r = f'aL{i}', f'aR{i}'
        if name.startswith('pan_'):
            body += [f'{l} = ainL', f'{r} = ainR', f'aCopyL = {l}', f'aCopyR = {r}']
            if name == 'pan_expr':
                body += [f'{l} = kA * aCopyL + kB * aCopyR',
                         f'{r} = kC * aCopyL + kD * aCopyR']
            elif name == 'pan_mac':
                body += [f'{l} mac kA, aCopyL, kB, aCopyR',
                         f'{r} mac kC, aCopyL, kD, aCopyR']
            elif name == 'pan_maca':
                body += ['aA = kA', 'aB = kB', 'aC = kC', 'aD = kD',
                         f'{l} maca aA, aCopyL, aB, aCopyR',
                         f'{r} maca aC, aCopyL, aD, aCopyR']
            outputs += [l, r]
        elif name.startswith('send_'):
            # Nonzero existing destination contribution exercises in-place mac.
            body += [f'{l} = ainR', f'{r} = ainL']
            if name == 'send_expr':
                body += [f'{l} += (ainL * kSend) * kGate',
                         f'{r} += (ainR * kSend) * kGate']
            elif name == 'send_kcombined':
                body += ['kGain = kSend * kGate', f'{l} += ainL * kGain',
                         f'{r} += ainR * kGain']
            elif name == 'send_mac':
                body += ['kGain = kSend * kGate', f'{l} mac 1, {l}, kGain, ainL',
                         f'{r} mac 1, {r}, kGain, ainR']
            outputs += [l, r]
        elif name.startswith('fade_'):
            body += [f'{l} = ainR', f'{r} = ainL']
            if name == 'fade_expr':
                body += [f'{l} = {l} * aInv + ainL * aEnv',
                         f'{r} = {r} * aInv + ainR * aEnv']
            else:
                body += [f'{l} maca {l}, aInv, ainL, aEnv',
                         f'{r} maca {r}, aInv, ainR, aEnv']
            outputs += [l, r]
        elif name.startswith('weighted_'):
            inputs = [f'aInput{i}_{j}' for j in range(32)]
            gains = [f'kGain{i}_{j}' for j in range(32)]
            init += [f'{v} init {(j + 1) * 0.00001}' for j, v in enumerate(inputs)]
            init += [f'{v} init {(j + 1) * 0.01}' for j, v in enumerate(gains)]
            body += [f'{l} = ainL']
            if name == 'weighted_adds':
                body += [f'{l} += {v} * {g}' for v, g in zip(inputs, gains)]
            else:
                terms = ['1', l] + [x for g, v in zip(gains, inputs) for x in [g, v]]
                body += [f'{l} mac ' + ', '.join(terms)]
            outputs += [l]
        elif name.startswith('sum_'):
            inputs = [f'aInput{i}_{j}' for j in range(32)]
            init += [f'{v} init {(j + 1) * 0.00001}' for j, v in enumerate(inputs)]
            body += [f'{l} = ainL']
            if name == 'sum_adds':
                body += [f'{l} += {v}' for v in inputs]
            elif name == 'sum_op':
                body += [f'{l} sum ' + ', '.join([l] + inputs)]
            outputs += [l]
        elif name.startswith('clear_'):
            body += [f'{l} = ainL', f'{r} = ainR']
            if name == 'clear_assign':
                body += [f'{l} = 0', f'{r} = 0']
            outputs += [l, r]
        elif name.startswith('add_'):
            body += [f'{l} = ainR', f'{r} = ainL']
            if name == 'add_expr':
                body += [f'{l} += ainL', f'{r} += ainR']
            else:
                body += [f'vincr {l}, ainL', f'vincr {r}, ainR']
            outputs += [l, r]
        else:
            raise ValueError(name)
    if name == 'clear_op':
        body += ['clear ' + ', '.join(outputs)]
    # All results reach output. Split channels to catch matrix-channel errors.
    body += ['aOutL sum ' + ', '.join(outputs[::2]),
             'aOutR sum ' + ', '.join(outputs[1::2]), 'outc aOutL, aOutR']
    return init, body


def write_csd(name, ksmps, duration, strips):
    init, body = workload(name, strips)
    text = '\n'.join(['<CsoundSynthesizer>', '<CsOptions>', '-d -m0', '</CsOptions>',
                      '<CsInstruments>', 'sr = 44100', f'ksmps = {ksmps}',
                      'nchnls = 2', '0dbfs = 1', 'instr 1', *init, *body, 'endin',
                      '</CsInstruments>', '<CsScore>', f'i 1 0 {duration}', 'e',
                      '</CsScore>', '</CsoundSynthesizer>', ''])
    path = ROOT / f'{name}-{ksmps}.csd'
    path.write_text(text)
    return path


def run(path, output=None):
    args = ['csound', '-+ignore_csopts=1', '-d', '-m0']
    args += ['-h', '-f', '-o', str(output)] if output else ['-n']
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    result = subprocess.run(args + [str(path)], capture_output=True, text=True)
    after = resource.getrusage(resource.RUSAGE_CHILDREN)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return after.ru_utime + after.ru_stime - before.ru_utime - before.ru_stime


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--duration', type=float, default=120)
    parser.add_argument('--repeats', type=int, default=5)
    parser.add_argument('--ksmps', type=int, nargs='+', default=[32, 64])
    parser.add_argument('--strips', type=int, default=64)
    parser.add_argument('--names', nargs='+')
    args = parser.parse_args()
    names = ['pan_expr', 'pan_mac', 'pan_maca', 'send_expr', 'send_kcombined',
             'send_mac', 'sum_adds', 'sum_op', 'clear_assign', 'clear_op',
             'add_expr', 'add_vincr', 'fade_expr', 'fade_maca',
             'weighted_adds', 'weighted_mac']
    names = args.names or names
    summary = {'parameters': vars(args), 'timings': {}, 'audio_checks': {}}
    for ksmps in args.ksmps:
        timings = {name: [] for name in names}
        paths = {name: write_csd(name, ksmps, args.duration, args.strips) for name in names}
        for path in paths.values():
            run(path)  # Warmup excluded.
        for rep in range(args.repeats):
            order = list(names)
            random.Random(100 + rep).shuffle(order)
            for name in order:
                timings[name].append(run(paths[name]))
            print(json.dumps({'ksmps': ksmps, 'repeat': rep + 1}), flush=True)
        summary['timings'][ksmps] = {
            name: {'median_cpu_seconds': statistics.median(values), 'runs': values}
            for name, values in timings.items()}
        audio = {}
        for name in names:
            path = write_csd(name, ksmps, 0.1, args.strips)
            raw = ROOT / f'{name}-{ksmps}.raw'
            run(path, raw)
            values = array.array('f')
            values.frombytes(raw.read_bytes())
            audio[name] = values
            # Restore the benchmark workload for reproducibility.
            write_csd(name, ksmps, args.duration, args.strips)
        groups = [('pan_expr', 'pan_mac'), ('pan_expr', 'pan_maca'),
                  ('send_expr', 'send_kcombined'), ('send_expr', 'send_mac'),
                  ('sum_adds', 'sum_op'), ('clear_assign', 'clear_op'),
                  ('add_expr', 'add_vincr'), ('fade_expr', 'fade_maca'),
                  ('weighted_adds', 'weighted_mac')]
        summary['audio_checks'][ksmps] = {}
        for baseline, candidate in groups:
            if baseline not in audio or candidate not in audio:
                continue
            assert len(audio[baseline]) == len(audio[candidate])
            error = max(abs(a - b) for a, b in zip(audio[baseline], audio[candidate]))
            assert error <= 1e-7, (baseline, candidate, error)
            summary['audio_checks'][ksmps][candidate] = {'max_float32_error': error}
        (ROOT / 'results.json').write_text(json.dumps(summary, indent=2))
        print(json.dumps({'ksmps': ksmps, 'results': summary['timings'][ksmps],
                          'audio_checks': summary['audio_checks'][ksmps]}), flush=True)


if __name__ == '__main__':
    main()
