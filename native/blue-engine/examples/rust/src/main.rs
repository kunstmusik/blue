//! Blue Engine Rust Test Client

use std::thread;
use std::time::Duration;

/// Command codes
#[repr(u8)]
#[derive(Clone, Copy)]
enum Command {
    CreateEngine = 0x01,
    CompileOrc = 0x02,
    ReadScore = 0x03,
    SetOption = 0x04,
    Start = 0x05,
    Stop = 0x06,
    DestroyEngine = 0x07,
    // Channel commands
    SetChannel = 0x10,
    GetChannel = 0x11,
    CreateChannel = 0x12,
    GetShmName = 0x13,
    // Automation commands
    CreateAutomation = 0x20,
    UpdateAutomation = 0x21,
    DeleteAutomation = 0x22,
    EnableAutomation = 0x23,
    DisableAutomation = 0x24,
    ListAutomations = 0x25,
    ClearAutomations = 0x26,
}

/// Status codes
#[repr(u8)]
#[derive(Clone, Copy, PartialEq)]
enum Status {
    Ok = 0x00,
    Error = 0x01,
}

/// Automation curve types
#[repr(u8)]
#[derive(Clone, Copy)]
enum AutomationCurve {
    Step = 0x00,
    Linear = 0x01,
    Exponential = 0x02,
}

struct AutomationPoint {
    time: f64,
    value: f64,
}

impl From<u8> for Status {
    fn from(v: u8) -> Self {
        match v {
            0x00 => Status::Ok,
            _ => Status::Error,
        }
    }
}

struct BlueEngineClient {
    socket: zmq::Socket,
}

impl BlueEngineClient {
    fn new(endpoint: &str) -> Result<Self, zmq::Error> {
        let context = zmq::Context::new();
        let socket = context.socket(zmq::REQ)?;
        socket.connect(endpoint)?;
        Ok(Self { socket })
    }

    fn send_command(&self, cmd: Command, payload: &[u8]) -> Result<(bool, String), zmq::Error> {
        // Build request
        let mut request = Vec::with_capacity(5 + payload.len());
        request.push(cmd as u8);
        request.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        request.extend_from_slice(payload);

        self.socket.send(&request, 0)?;

        // Receive response
        let response = self.socket.recv_bytes(0)?;
        if response.len() < 5 {
            return Ok((false, "Invalid response".to_string()));
        }

        let status = Status::from(response[0]);
        let msg_len = u32::from_le_bytes([response[1], response[2], response[3], response[4]]) as usize;
        let message = String::from_utf8_lossy(&response[5..5 + msg_len]).to_string();

        Ok((status == Status::Ok, message))
    }

    fn create_engine(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::CreateEngine, &[])
    }

    fn compile_orc(&self, orc: &str) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::CompileOrc, orc.as_bytes())
    }

    fn read_score(&self, sco: &str) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::ReadScore, sco.as_bytes())
    }

    fn set_option(&self, option: &str) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::SetOption, option.as_bytes())
    }

    fn start(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::Start, &[])
    }

    fn stop(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::Stop, &[])
    }

    fn destroy_engine(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::DestroyEngine, &[])
    }

    fn create_channel(&self, name: &str, initial_value: f64) -> Result<(bool, String), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(name.as_bytes());
        payload.push(0); // null terminator
        payload.extend_from_slice(&initial_value.to_le_bytes());
        self.send_command(Command::CreateChannel, &payload)
    }

    fn set_channel(&self, name: &str, value: f64) -> Result<(bool, String), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(name.as_bytes());
        payload.push(0); // null terminator
        payload.extend_from_slice(&value.to_le_bytes());
        self.send_command(Command::SetChannel, &payload)
    }

    #[allow(dead_code)]
    fn get_channel(&self, name: &str) -> Result<(bool, f64), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(name.as_bytes());
        payload.push(0); // null terminator
        let (ok, msg) = self.send_command(Command::GetChannel, &payload)?;
        if ok && msg.len() >= 8 {
            let bytes: [u8; 8] = msg.as_bytes()[..8].try_into().unwrap_or([0; 8]);
            Ok((true, f64::from_le_bytes(bytes)))
        } else {
            Ok((false, 0.0))
        }
    }

    fn create_automation(
        &self,
        channel_name: &str,
        curve: AutomationCurve,
        points: &[AutomationPoint],
        enabled: bool,
        resolution_decimal: &str,
    ) -> Result<(bool, u32), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(channel_name.as_bytes());
        payload.push(0); // null terminator
        payload.push(curve as u8);
        payload.push(if enabled { 1 } else { 0 });
        payload.extend_from_slice(&(resolution_decimal.len() as u32).to_le_bytes());
        payload.extend_from_slice(resolution_decimal.as_bytes());
        payload.extend_from_slice(&(points.len() as u32).to_le_bytes());

        for pt in points {
            payload.extend_from_slice(&pt.time.to_le_bytes());
            payload.extend_from_slice(&pt.value.to_le_bytes());
        }

        let (ok, msg) = self.send_command(Command::CreateAutomation, &payload)?;
        let id = if ok && msg.len() >= 4 {
            u32::from_le_bytes([
                msg.as_bytes()[0],
                msg.as_bytes()[1],
                msg.as_bytes()[2],
                msg.as_bytes()[3],
            ])
        } else {
            0
        };
        Ok((ok, id))
    }

    fn enable_automation(&self, channel_name: &str) -> Result<(bool, String), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(channel_name.as_bytes());
        payload.push(0);
        self.send_command(Command::EnableAutomation, &payload)
    }

    fn disable_automation(&self, channel_name: &str) -> Result<(bool, String), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(channel_name.as_bytes());
        payload.push(0);
        self.send_command(Command::DisableAutomation, &payload)
    }

    #[allow(dead_code)]
    fn delete_automation(&self, channel_name: &str) -> Result<(bool, String), zmq::Error> {
        let mut payload = Vec::new();
        payload.extend_from_slice(channel_name.as_bytes());
        payload.push(0);
        self.send_command(Command::DeleteAutomation, &payload)
    }

    fn list_automations(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::ListAutomations, &[])
    }

    fn clear_automations(&self) -> Result<(bool, String), zmq::Error> {
        self.send_command(Command::ClearAutomations, &[])
    }
}

fn main() -> Result<(), zmq::Error> {
    // Parse optional --test selector
    let args: Vec<String> = std::env::args().collect();
    let mut selected_test: Option<u32> = None;

    let mut i = 1;
    while i < args.len() {
        if let Some(rest) = args[i].strip_prefix("--test=") {
            if let Ok(v) = rest.parse::<u32>() {
                selected_test = Some(v);
            }
        } else if args[i] == "--test" && i + 1 < args.len() {
            if let Ok(v) = args[i + 1].parse::<u32>() {
                selected_test = Some(v);
            }
            i += 1;
        }
        i += 1;
    }

    println!("Connecting to blue-engine...");

    let client = BlueEngineClient::new("tcp://localhost:5555")?;

    // Compile orchestra using standard chnexport control channels.
    let orc = r#"
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
    "#;

    // Test 1: Manual channel updates
    if selected_test.is_none() || selected_test == Some(1) {
        // Create engine
        let (ok, msg) = client.create_engine()?;
        println!("create_engine: {} {}", if ok { "OK" } else { "FAILED" }, msg);
        if !ok {
            return Ok(());
        }

        // Set options
        client.set_option("-odac")?;
        println!("set_option(-odac): OK");

        client.set_option("-d")?;
        println!("set_option(-d): OK");

        let (ok, msg) = client.compile_orc(orc)?;
        println!("compile_orc: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        // Create channels
        let (ok, _) = client.create_channel("freq", 440.0)?;
        println!("create_channel(freq): {}", if ok { "OK" } else { "FAILED" });

        let (ok, _) = client.create_channel("amp", 0.5)?;
        println!("create_channel(amp): {}", if ok { "OK" } else { "FAILED" });

        println!("\n=== Test 1: Manual Channel Updates ===");
        let (ok, msg) = client.read_score("i1 0 5")?;
        println!("read_score: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        // Start
        let (ok, msg) = client.start()?;
        println!("start: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        // Demonstrate channel updates
        println!("Playing with channel updates...");
        let frequencies = [440, 550, 660, 880, 660, 550, 440];
        for freq in frequencies {
            let (ok, _) = client.set_channel("freq", freq as f64)?;
            println!("  set freq={}: {}", freq, if ok { "OK" } else { "FAILED" });
            thread::sleep(Duration::from_millis(400));
        }

        // Stop
        client.stop()?;
        println!("stop: OK");

        // Destroy
        client.destroy_engine()?;
        println!("destroy_engine: OK");
    }

    // Test 2: LINEAR curve automation
    if selected_test.is_none() || selected_test == Some(2) {
        println!("\n=== Test 2: LINEAR Curve Automation ===");
        client.create_engine()?;
        println!("create_engine: OK");
        client.set_option("-odac")?;
        client.set_option("-d")?;
        client.compile_orc(orc)?;
        println!("compile_orc: OK");
        client.create_channel("freq", 440.0)?;
        println!("create_channel(freq): OK");
        client.create_channel("amp", 0.5)?;
        println!("create_channel(amp): OK");

        let linear_points = vec![
            AutomationPoint { time: 2.0, value: 440.0 },
            AutomationPoint { time: 4.0, value: 880.0 },
        ];
        let (ok, id) = client.create_automation("freq", AutomationCurve::Linear, &linear_points, false, "0")?;
        println!("create_automation (LINEAR): {}, ID={}", if ok { "OK" } else { "FAILED" }, id);

        client.read_score("i1 0 6")?;
        println!("read_score: OK");
        client.start()?;
        println!("start: OK");

        println!("Playing for 2 seconds with automation disabled (steady 440Hz)...");
        thread::sleep(Duration::from_secs(2));

        println!("Enabling LINEAR automation (440Hz -> 880Hz over 2 seconds)...");
        let (ok, msg) = client.enable_automation("freq")?;
        println!("enable_automation: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        thread::sleep(Duration::from_millis(2500));

        client.stop()?;
        println!("stop: OK");
    }

    // Test 3: STEP curve
    if selected_test.is_none() || selected_test == Some(3) {
        println!("\n=== Test 3: STEP Curve Automation ===");
        client.destroy_engine()?;
        client.create_engine()?;
        client.set_option("-odac")?;
        client.set_option("-d")?;
        client.compile_orc(orc)?;
        client.create_channel("freq", 440.0)?;
        client.create_channel("amp", 0.5)?;

        let step_points = vec![
            AutomationPoint { time: 2.0, value: 440.0 },
            AutomationPoint { time: 2.5, value: 550.0 },
            AutomationPoint { time: 3.0, value: 660.0 },
            AutomationPoint { time: 3.5, value: 880.0 },
            AutomationPoint { time: 4.0, value: 660.0 },
        ];
        let (ok, id) = client.create_automation("freq", AutomationCurve::Step, &step_points, false, "0")?;
        println!("create_automation (STEP): {}, ID={}", if ok { "OK" } else { "FAILED" }, id);

        client.read_score("i1 0 6")?;
        client.start()?;

        println!("Waiting 2 seconds before enabling STEP automation...");
        thread::sleep(Duration::from_secs(2));

        println!("Enabling STEP automation (frequency jumps every 0.5 seconds)...");
        let (ok, msg) = client.enable_automation("freq")?;
        println!("enable_automation: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        thread::sleep(Duration::from_millis(2500));

        client.stop()?;
        println!("stop: OK");
    }

    // Test 4: EXPONENTIAL curve
    if selected_test.is_none() || selected_test == Some(4) {
        println!("\n=== Test 4: EXPONENTIAL Curve Automation ===");
        client.destroy_engine()?;
        client.create_engine()?;
        client.set_option("-odac")?;
        client.set_option("-d")?;
        client.compile_orc(orc)?;
        client.create_channel("freq", 440.0)?;
        client.create_channel("amp", 0.5)?;

        let exp_points = vec![
            AutomationPoint { time: 2.0, value: 220.0 },
            AutomationPoint { time: 4.0, value: 880.0 },
        ];
        let (ok, id) = client.create_automation("freq", AutomationCurve::Exponential, &exp_points, false, "0")?;
        println!("create_automation (EXPONENTIAL): {}, ID={}", if ok { "OK" } else { "FAILED" }, id);

        client.read_score("i1 0 6")?;
        client.start()?;

        println!("Waiting 2 seconds before enabling EXPONENTIAL automation...");
        thread::sleep(Duration::from_secs(2));

        println!("Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...");
        let (ok, msg) = client.enable_automation("freq")?;
        println!("enable_automation: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        thread::sleep(Duration::from_millis(2500));

        client.stop()?;
        println!("stop: OK");

        // List and clear automations
        println!("\n=== Listing Automations ===");
        let (ok, msg) = client.list_automations()?;
        println!("list_automations: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        println!("\nClearing all automations...");
        let (ok, msg) = client.clear_automations()?;
        println!("clear_automations: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        // Final cleanup
        client.destroy_engine()?;
        println!("destroy_engine: OK");
    }

    // Test 5: LINEAR automation with resolution (quantization)
    if selected_test.is_none() || selected_test == Some(5) {
        println!("\n=== Test 5: LINEAR Automation with Resolution ===");
        client.create_engine()?;
        println!("create_engine: OK");
        client.set_option("-odac")?;
        client.set_option("-d")?;
        client.compile_orc(orc)?;
        client.create_channel("freq", 220.0)?;
        println!("create_channel(freq): OK");
        client.create_channel("amp", 0.5)?;
        println!("create_channel(amp): OK");

        let quant_points = vec![
            AutomationPoint { time: 2.0, value: 220.0 },
            AutomationPoint { time: 6.0, value: 880.0 },
        ];
        let resolution = "100";
        let (ok, id) = client.create_automation("freq", AutomationCurve::Linear, &quant_points, false, resolution)?;
        println!(
            "create_automation (LINEAR + resolution={}): {}, ID={}",
            resolution,
            if ok { "OK" } else { "FAILED" },
            id
        );

        client.read_score("i1 0 8")?;
        println!("read_score: OK");
        client.start()?;
        println!("start: OK");

        println!("Waiting 2 seconds before enabling quantized automation...");
        thread::sleep(Duration::from_secs(2));

        println!("Enabling quantized LINEAR automation (listen for stepped pitch changes)...");
        let (ok, msg) = client.enable_automation("freq")?;
        println!("enable_automation: {} {}", if ok { "OK" } else { "FAILED" }, msg);

        thread::sleep(Duration::from_millis(4500));

        client.stop()?;
        println!("stop: OK");

        client.destroy_engine()?;
        println!("destroy_engine: OK");
    }

    println!("\nAll tests completed!");
    Ok(())
}
