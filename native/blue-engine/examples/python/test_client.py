#!/usr/bin/env python3
"""
Test client for blue-engine
"""

import sys
import time
from blue_engine_client import BlueEngineClient, AutomationCurve


def main(selected_test=None):
    print("Connecting to blue-engine...")

    with BlueEngineClient() as client:
        # Compile orchestra using standard chnexport control channels.
        orc = """
        sr = 44100
        ksmps = 64
        nchnls = 2
        0dbfs = 1

        gk_freq init 440
        gk_freq chnexport "freq", 3

        gk_amp init 0.5
        gk_amp chnexport "amp", 3

        instr 1
            aenv = linseg:a(0, 0.01, 1, p3 - 0.02, 1, 0.01, 0)
            asig = oscil:a(aenv * gk_amp, gk_freq)
            out(asig, asig)
        endin
        """

        if selected_test is None or selected_test == 1:
            # Create engine
            ok, msg = client.create_engine()
            print(f"create_engine: {'OK' if ok else 'FAILED'} {msg}")
            if not ok:
                return

            # Set options
            ok, msg = client.set_option("-odac")
            print(f"set_option(-odac): {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.set_option("-d")
            print(f"set_option(-d): {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.compile_orc(orc)
            print(f"compile_orc: {'OK' if ok else 'FAILED'} {msg}")
            if not ok:
                return

            # Create channels
            ok, msg = client.create_channel("freq", 440.0)
            print(f"create_channel(freq): {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.create_channel("amp", 0.5)
            print(f"create_channel(amp): {'OK' if ok else 'FAILED'} {msg}")

            # Test 1: Manual channel updates (original test)
            print("\n=== Test 1: Manual Channel Updates ===")
            sco = "i1 0 5"
            ok, msg = client.read_score(sco)
            print(f"read_score: {'OK' if ok else 'FAILED'} {msg}")

            # Start
            ok, msg = client.start()
            print(f"start: {'OK' if ok else 'FAILED'} {msg}")
            if not ok:
                return

            # Demonstrate channel updates
            print("Playing with channel updates...")
            frequencies = [440, 550, 660, 880, 660, 550, 440]
            for freq in frequencies:
                ok, msg = client.set_channel("freq", float(freq))
                print(f"  set freq={freq}: {'OK' if ok else 'FAILED'}")
                time.sleep(0.4)

            # Stop
            ok, msg = client.stop()
            print(f"stop: {'OK' if ok else 'FAILED'} {msg}")

            # Destroy
            ok, msg = client.destroy_engine()
            print(f"destroy_engine: {'OK' if ok else 'FAILED'} {msg}")

        if selected_test is None or selected_test == 2:
            # Test 2: Automation system
            print("\n=== Test 2: Automation System ===")

            # Create new engine for automation test
            ok, msg = client.create_engine()
            print(f"create_engine: {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.set_option("-odac")
            ok, msg = client.set_option("-d")

            ok, msg = client.compile_orc(orc)
            print(f"compile_orc: {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.create_channel("freq", 440.0)
            print(f"create_channel(freq): {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.create_channel("amp", 0.5)
            print(f"create_channel(amp): {'OK' if ok else 'FAILED'} {msg}")

            # Create automation from time 2 to 4 (freq goes 440 -> 880)
            # Points: (time_seconds, value)
            points = [
                (2.0, 440.0),   # Start at 440Hz at 2 seconds
                (4.0, 880.0),   # End at 880Hz at 4 seconds
            ]

            print("\nCreating automation (disabled initially)...")
            ok, auto_id = client.create_automation("freq", AutomationCurve.LINEAR, points, enabled=False)
            print(f"create_automation: {'OK' if ok else 'FAILED'}, ID={auto_id}")

            # Schedule a 6-second note
            sco = "i1 0 6"
            ok, msg = client.read_score(sco)
            print(f"read_score: {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.start()
            print(f"start: {'OK' if ok else 'FAILED'} {msg}")

            print("\nPlaying for 2 seconds with automation disabled (steady 440Hz)...")
            time.sleep(2)

            print("\nEnabling automation (LINEAR curve: 440Hz -> 880Hz over 2 seconds)...")
            ok, msg = client.enable_automation("freq")
            print(f"enable_automation: {'OK' if ok else 'FAILED'} {msg}")

            time.sleep(2.5)  # Let automation complete

            ok, msg = client.stop()
            print(f"stop: {'OK' if ok else 'FAILED'} {msg}")

        if selected_test is None or selected_test == 3:
            # Test STEP curve
            print("\n=== Test 3: STEP Curve Automation ===")
            ok, msg = client.destroy_engine()
            ok, msg = client.create_engine()
            ok, msg = client.set_option("-odac")
            ok, msg = client.set_option("-d")
            ok, msg = client.compile_orc(orc)
            ok, msg = client.create_channel("freq", 440.0)
            ok, msg = client.create_channel("amp", 0.5)

            # STEP automation: jump between frequencies
            step_points = [
                (2.0, 440.0),
                (2.5, 550.0),
                (3.0, 660.0),
                (3.5, 880.0),
                (4.0, 660.0),
            ]

            ok, auto_id = client.create_automation("freq", AutomationCurve.STEP, step_points, enabled=False)
            print(f"create_automation (STEP): {'OK' if ok else 'FAILED'}, ID={auto_id}")

            sco = "i1 0 6"
            ok, msg = client.read_score(sco)
            ok, msg = client.start()

            print("Waiting 2 seconds before enabling STEP automation...")
            time.sleep(2)

            print("Enabling STEP automation (frequency jumps every 0.5 seconds)...")
            ok, msg = client.enable_automation("freq")
            print(f"enable_automation: {'OK' if ok else 'FAILED'} {msg}")

            time.sleep(2.5)

            ok, msg = client.stop()
            print(f"stop: {'OK' if ok else 'FAILED'} {msg}")

        if selected_test is None or selected_test == 4:
            # Test EXPONENTIAL curve
            print("\n=== Test 4: EXPONENTIAL Curve Automation ===")
            ok, msg = client.destroy_engine()
            ok, msg = client.create_engine()
            ok, msg = client.set_option("-odac")
            ok, msg = client.set_option("-d")
            ok, msg = client.compile_orc(orc)
            ok, msg = client.create_channel("freq", 440.0)
            ok, msg = client.create_channel("amp", 0.5)

            # EXPONENTIAL automation: smooth exponential glide
            exp_points = [
                (2.0, 220.0),
                (4.0, 880.0),
            ]

            ok, auto_id = client.create_automation("freq", AutomationCurve.EXPONENTIAL, exp_points, enabled=False)
            print(f"create_automation (EXPONENTIAL): {'OK' if ok else 'FAILED'}, ID={auto_id}")

            sco = "i1 0 6"
            ok, msg = client.read_score(sco)
            ok, msg = client.start()

            print("Waiting 2 seconds before enabling EXPONENTIAL automation...")
            time.sleep(2)

            print("Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...")
            ok, msg = client.enable_automation("freq")
            print(f"enable_automation: {'OK' if ok else 'FAILED'} {msg}")

            time.sleep(2.5)

            ok, msg = client.stop()
            print(f"stop: {'OK' if ok else 'FAILED'} {msg}")

            # List automations
            print("\n=== Listing Automations ===")
            ok, automations = client.list_automations()
            print(f"list_automations: {'OK' if ok else 'FAILED'}")
            for auto in automations:
                print(f"  ID={auto['id']}, channel={auto['channel']}, enabled={auto['enabled']}, points={auto['n_points']}")

            # Clear all automations
            print("\nClearing all automations...")
            ok, msg = client.clear_automations()
            print(f"clear_automations: {'OK' if ok else 'FAILED'} {msg}")

            # Final cleanup
            ok, msg = client.destroy_engine()
            print(f"destroy_engine: {'OK' if ok else 'FAILED'} {msg}")

        if selected_test is None or selected_test == 5:
            # Test 5: LINEAR automation with resolution (quantization)
            print("\n=== Test 5: LINEAR Automation with Resolution ===")
            ok, msg = client.create_engine()
            print(f"create_engine: {'OK' if ok else 'FAILED'} {msg}")
            ok, msg = client.set_option("-odac")
            ok, msg = client.set_option("-d")
            ok, msg = client.compile_orc(orc)
            ok, msg = client.create_channel("freq", 220.0)
            ok, msg = client.create_channel("amp", 0.5)

            # Smooth glide 220 -> 880 over 4 seconds, but quantized to coarse steps
            quant_points = [
                (2.0, 220.0),
                (6.0, 880.0),
            ]

            # Use a large resolution so you can clearly hear stepped changes
            resolution = "100"

            ok, auto_id = client.create_automation(
                "freq",
                AutomationCurve.LINEAR,
                quant_points,
                enabled=False,
                resolution_decimal=resolution,
            )
            print(
                f"create_automation (LINEAR + resolution={resolution}): "
                f"{'OK' if ok else 'FAILED'}, ID={auto_id}"
            )

            sco = "i1 0 8"
            ok, msg = client.read_score(sco)
            ok, msg = client.start()

            print("Waiting 2 seconds before enabling quantized automation...")
            time.sleep(2)

            print("Enabling quantized LINEAR automation (listen for stepped pitch changes)...")
            ok, msg = client.enable_automation("freq")
            print(f"enable_automation: {'OK' if ok else 'FAILED'} {msg}")

            time.sleep(4.5)

            ok, msg = client.stop()
            print(f"stop: {'OK' if ok else 'FAILED'} {msg}")

            ok, msg = client.destroy_engine()
            print(f"destroy_engine: {'OK' if ok else 'FAILED'} {msg}")

    print("\nAll tests completed!")


if __name__ == "__main__":
    selected = None
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg.startswith("--test="):
            try:
                selected = int(arg.split("=", 1)[1])
            except ValueError:
                selected = None
        elif arg == "--test" and i + 1 < len(args):
            try:
                selected = int(args[i + 1])
            except ValueError:
                selected = None
    main(selected)
