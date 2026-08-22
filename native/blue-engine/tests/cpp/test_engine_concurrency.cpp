#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "protocol/Capabilities.h"
#include "protocol/Protocol.h"

#include <cassert>
#include <chrono>
#include <iostream>
#include <thread>
#include <zmq.h>

int main() {
  // Test two concurrent engine/handler pairs binding to distinct TCP ports
  blue::SharedMemory shm1;
  blue::SharedMemory shm2;
  blue::CsoundEngine engine1;
  blue::CsoundEngine engine2;

  blue::ZmqHandler handler1(engine1, shm1);
  blue::ZmqHandler handler2(engine2, shm2);

  const int port1 = 5710;
  const int pubPort1 = 5711;
  const int port2 = 5712;
  const int pubPort2 = 5713;

  assert(handler1.bind(port1, pubPort1));
  assert(handler2.bind(port2, pubPort2));

  // Run handler background threads to process requests
  std::atomic<bool> stopHandlers{false};
  std::thread thread1([&handler1, &stopHandlers]() {
    while (!stopHandlers.load()) {
      handler1.processOne();
    }
  });

  std::thread thread2([&handler2, &stopHandlers]() {
    while (!stopHandlers.load()) {
      handler2.processOne();
    }
  });

  // Create two ZMQ REQ clients connecting to each engine independently
  void *context = zmq_ctx_new();
  assert(context != nullptr);

  void *req1 = zmq_socket(context, ZMQ_REQ);
  assert(req1 != nullptr);
  std::string addr1 = "tcp://127.0.0.1:" + std::to_string(port1);
  assert(zmq_connect(req1, addr1.c_str()) == 0);

  void *req2 = zmq_socket(context, ZMQ_REQ);
  assert(req2 != nullptr);
  std::string addr2 = "tcp://127.0.0.1:" + std::to_string(port2);
  assert(zmq_connect(req2, addr2.c_str()) == 0);

  // Send GET_CAPABILITIES (1 byte command + 4 bytes length 0) to both and verify responses
  uint8_t reqBytes[5] = { static_cast<uint8_t>(blue::Command::GET_CAPABILITIES), 0, 0, 0, 0 };

  // Client 1 request/response
  assert(zmq_send(req1, reqBytes, sizeof(reqBytes), 0) == sizeof(reqBytes));
  char buf1[4096];
  int len1 = zmq_recv(req1, buf1, sizeof(buf1), 0);
  assert(len1 > 5);
  assert(static_cast<uint8_t>(buf1[0]) == static_cast<uint8_t>(blue::Status::OK));

  // Client 2 request/response
  assert(zmq_send(req2, reqBytes, sizeof(reqBytes), 0) == sizeof(reqBytes));
  char buf2[4096];
  int len2 = zmq_recv(req2, buf2, sizeof(buf2), 0);
  assert(len2 > 5);
  assert(static_cast<uint8_t>(buf2[0]) == static_cast<uint8_t>(blue::Status::OK));

  // Clean up clients
  zmq_close(req1);
  zmq_close(req2);
  zmq_ctx_term(context);

  // Stop handlers
  handler1.requestShutdown();
  handler2.requestShutdown();
  stopHandlers = true;

  if (thread1.joinable()) thread1.join();
  if (thread2.joinable()) thread2.join();

  std::cout << "Engine concurrency tests passed\n";
  return 0;
}
