"""
Blue Engine Python Client Library
"""

import struct
from enum import IntEnum
from typing import Tuple

import zmq


class Command(IntEnum):
    CREATE_ENGINE = 0x01
    COMPILE_ORC = 0x02
    READ_SCORE = 0x03
    SET_OPTION = 0x04
    START = 0x05
    STOP = 0x06
    DESTROY_ENGINE = 0x07
    # Channel commands
    SET_CHANNEL = 0x10
    GET_CHANNEL = 0x11
    CREATE_CHANNEL = 0x12
    GET_SHM_NAME = 0x13
    # Automation commands
    CREATE_AUTOMATION = 0x20
    UPDATE_AUTOMATION = 0x21
    DELETE_AUTOMATION = 0x22
    ENABLE_AUTOMATION = 0x23
    DISABLE_AUTOMATION = 0x24
    LIST_AUTOMATIONS = 0x25
    CLEAR_AUTOMATIONS = 0x26


class Status(IntEnum):
    OK = 0x00
    ERROR = 0x01


class AutomationCurve(IntEnum):
    STEP = 0x00
    LINEAR = 0x01
    EXPONENTIAL = 0x02


class BlueEngineClient:
    """Client for communicating with blue-engine process."""

    def __init__(self, host: str = "localhost", port: int = 5555):
        self.endpoint = f"tcp://{host}:{port}"
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REQ)
        self.socket.connect(self.endpoint)

    def close(self):
        """Close the connection."""
        self.socket.close()
        self.context.term()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _send_command(self, cmd: Command, payload: bytes = b"") -> Tuple[Status, str]:
        """Send a command and receive response."""
        # Build request: cmd (1 byte) + len (4 bytes LE) + payload
        request = struct.pack("<BI", cmd, len(payload)) + payload
        self.socket.send(request)

        # Receive response
        response = self.socket.recv()
        if len(response) < 5:
            return Status.ERROR, "Invalid response"

        status = Status(response[0])
        payload_len = struct.unpack("<I", response[1:5])[0]
        payload_data = response[5 : 5 + payload_len].decode("utf-8", errors="replace")

        return status, payload_data

    def create_engine(self) -> Tuple[bool, str]:
        """Create a new Csound engine instance."""
        status, msg = self._send_command(Command.CREATE_ENGINE)
        if status == Status.OK:
            return True, msg

        if status == Status.ERROR and "Engine already created" in msg:
            # Clean up stale engine and retry once
            self._send_command(Command.DESTROY_ENGINE)
            status, msg = self._send_command(Command.CREATE_ENGINE)

        return status == Status.OK, msg

    def compile_orc(self, orc: str) -> Tuple[bool, str]:
        """Compile orchestra code."""
        status, msg = self._send_command(Command.COMPILE_ORC, orc.encode("utf-8"))
        return status == Status.OK, msg

    def read_score(self, sco: str) -> Tuple[bool, str]:
        """Read score events."""
        status, msg = self._send_command(Command.READ_SCORE, sco.encode("utf-8"))
        return status == Status.OK, msg

    def set_option(self, option: str) -> Tuple[bool, str]:
        """Set a Csound option."""
        status, msg = self._send_command(Command.SET_OPTION, option.encode("utf-8"))
        return status == Status.OK, msg

    def start(self) -> Tuple[bool, str]:
        """Start audio processing."""
        status, msg = self._send_command(Command.START)
        return status == Status.OK, msg

    def stop(self) -> Tuple[bool, str]:
        """Stop audio processing."""
        status, msg = self._send_command(Command.STOP)
        return status == Status.OK, msg

    def destroy_engine(self) -> Tuple[bool, str]:
        """Destroy the Csound engine instance."""
        status, msg = self._send_command(Command.DESTROY_ENGINE)
        return status == Status.OK, msg

    # Channel operations
    def create_channel(self, name: str, initial_value: float = 0.0) -> Tuple[bool, str]:
        """Create a channel value or stage it until the orchestra exports it."""
        payload = name.encode("utf-8") + b"\x00" + struct.pack("<d", initial_value)
        status, msg = self._send_command(Command.CREATE_CHANNEL, payload)
        return status == Status.OK, msg

    def set_channel(self, name: str, value: float) -> Tuple[bool, str]:
        """Set a channel value."""
        payload = name.encode("utf-8") + b"\x00" + struct.pack("<d", value)
        status, msg = self._send_command(Command.SET_CHANNEL, payload)
        return status == Status.OK, msg

    def get_channel(self, name: str) -> Tuple[bool, float]:
        """Get a channel value."""
        payload = name.encode("utf-8") + b"\x00"
        status, data = self._send_command(Command.GET_CHANNEL, payload)
        if status == Status.OK and len(data) >= 8:
            value = struct.unpack("<d", data[:8].encode("latin-1"))[0]
            return True, value
        return False, 0.0

    def get_shm_name(self) -> Tuple[bool, str]:
        """Get the shared-memory mirror name."""
        status, msg = self._send_command(Command.GET_SHM_NAME)
        return status == Status.OK, msg

    # Automation operations
    def create_automation(
        self,
        channel_name: str,
        curve: AutomationCurve,
        points: list,
        enabled: bool = True,
        resolution: float = 0.0,
        resolution_scale: int = 0,
        high_precision: bool = False,
    ) -> Tuple[bool, int]:
        """Create an automation for a channel.

        Args:
            channel_name: Name of the channel to automate
            curve: Interpolation curve type
            points: List of (time, value) tuples
            enabled: Whether automation starts enabled
            resolution: Quantization step size (0 = no quantization)
            resolution_scale: Decimal scale for resolution (e.g., 1 for 0.1, 2 for 0.01)
            high_precision: Use BigDecimal-compatible quantization

        Returns:
            (success, automation_id)
        """
        # Build payload: channel_name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points
        payload = channel_name.encode("utf-8") + b"\x00"
        payload += struct.pack("<BBdiBI",
                               curve,
                               1 if enabled else 0,
                               float(resolution),
                               resolution_scale,
                               1 if high_precision else 0,
                               len(points))

        for time, value in points:
            payload += struct.pack("<dd", time, value)

        status, data = self._send_command(Command.CREATE_AUTOMATION, payload)
        if status == Status.OK and len(data) >= 4:
            auto_id = struct.unpack("<I", data[:4].encode("latin-1"))[0]
            return True, auto_id
        return False, 0

    def update_automation(
        self,
        channel_name: str,
        curve: AutomationCurve,
        points: list,
        enabled: bool = True,
        resolution: float = 0.0,
        resolution_scale: int = 0,
        high_precision: bool = False,
    ) -> Tuple[bool, str]:
        """Update an existing automation."""
        payload = channel_name.encode("utf-8") + b"\x00"
        payload += struct.pack("<BBdiBI",
                               curve,
                               1 if enabled else 0,
                               float(resolution),
                               resolution_scale,
                               1 if high_precision else 0,
                               len(points))

        for time, value in points:
            payload += struct.pack("<dd", time, value)

        status, msg = self._send_command(Command.UPDATE_AUTOMATION, payload)
        return status == Status.OK, msg

    def delete_automation(self, channel_name: str) -> Tuple[bool, str]:
        """Delete an automation."""
        payload = channel_name.encode("utf-8") + b"\x00"
        status, msg = self._send_command(Command.DELETE_AUTOMATION, payload)
        return status == Status.OK, msg

    def enable_automation(self, channel_name: str) -> Tuple[bool, str]:
        """Enable an automation."""
        payload = channel_name.encode("utf-8") + b"\x00"
        status, msg = self._send_command(Command.ENABLE_AUTOMATION, payload)
        return status == Status.OK, msg

    def disable_automation(self, channel_name: str) -> Tuple[bool, str]:
        """Disable an automation."""
        payload = channel_name.encode("utf-8") + b"\x00"
        status, msg = self._send_command(Command.DISABLE_AUTOMATION, payload)
        return status == Status.OK, msg

    def list_automations(self) -> Tuple[bool, list]:
        """List all automations."""
        status, data = self._send_command(Command.LIST_AUTOMATIONS)
        if status != Status.OK or len(data) < 4:
            return False, []

        # Parse response: count(4B) + entries
        data_bytes = data.encode("latin-1")
        count = struct.unpack("<I", data_bytes[:4])[0]

        automations = []
        offset = 4
        for _ in range(count):
            if offset + 73 > len(data_bytes):
                break

            auto_id = struct.unpack("<I", data_bytes[offset : offset + 4])[0]
            offset += 4

            enabled = data_bytes[offset] != 0
            offset += 1

            channel_name = data_bytes[offset : offset + 64].decode("utf-8").rstrip("\x00")
            offset += 64

            n_points = struct.unpack("<I", data_bytes[offset : offset + 4])[0]
            offset += 4

            automations.append({
                "id": auto_id,
                "enabled": enabled,
                "channel": channel_name,
                "n_points": n_points,
            })

        return True, automations

    def clear_automations(self) -> Tuple[bool, str]:
        """Clear all automations."""
        status, msg = self._send_command(Command.CLEAR_AUTOMATIONS)
        return status == Status.OK, msg
