#include "../../src/engine/RealtimeChannelMailbox.h"

#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

void require(bool condition, const std::string &message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

void testWholeBatchAndFifoApplication() {
  blue::RealtimeChannelMailbox mailbox;
  double first = 0.0;
  double second = 0.0;

  require(mailbox.enqueue(7, {{&first, 1.0}, {&second, 2.0}}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::Accepted,
          "first batch should enqueue");
  require(mailbox.enqueue(7, {{&first, 3.0}, {&second, 4.0}}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::Accepted,
          "second batch should enqueue");

  require(mailbox.consumeOne(7) ==
              blue::RealtimeChannelMailbox::ConsumeResult::Applied,
          "first batch should apply");
  require(first == 1.0 && second == 2.0,
          "one consume must expose exactly one complete batch");

  require(mailbox.consumeOne(7) ==
              blue::RealtimeChannelMailbox::ConsumeResult::Applied,
          "second batch should apply");
  require(first == 3.0 && second == 4.0,
          "batches must preserve producer order");
  require(mailbox.consumeOne(7) ==
              blue::RealtimeChannelMailbox::ConsumeResult::Empty,
          "drained mailbox should report empty");
}

void testStaleGenerationIsDiscarded() {
  blue::RealtimeChannelMailbox mailbox;
  double value = 5.0;
  require(mailbox.enqueue(3, {{&value, 9.0}}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::Accepted,
          "stale batch should enqueue before generation changes");
  require(mailbox.consumeOne(4) ==
              blue::RealtimeChannelMailbox::ConsumeResult::StaleGeneration,
          "stale batch should be discarded");
  require(value == 5.0, "stale batch must not touch its old pointer");
}

void testInputAndCapacityBounds() {
  blue::RealtimeChannelMailbox mailbox;
  double value = 0.0;
  require(mailbox.enqueue(1, {}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::InvalidBatch,
          "empty batch should be rejected");
  require(mailbox.enqueue(1, {{nullptr, 1.0}}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::InvalidBatch,
          "null channel pointer should be rejected");

  for (size_t index = 0; index < blue::RealtimeChannelMailbox::kCapacity; ++index) {
    require(mailbox.enqueue(1, {{&value, static_cast<double>(index)}}) ==
                blue::RealtimeChannelMailbox::EnqueueResult::Accepted,
            "mailbox should accept every advertised slot");
  }
  require(mailbox.enqueue(1, {{&value, 999.0}}) ==
              blue::RealtimeChannelMailbox::EnqueueResult::Full,
          "mailbox should reject without overwriting unread data");
}

void testConcurrentProducerConsumerOrdering() {
  blue::RealtimeChannelMailbox mailbox;
  constexpr size_t kBatchCount = 10000;
  double value = 0.0;

  std::thread producer([&]() {
    for (size_t index = 1; index <= kBatchCount; ++index) {
      while (mailbox.enqueue(
                 9, {{&value, static_cast<double>(index)}}) ==
             blue::RealtimeChannelMailbox::EnqueueResult::Full) {
        std::this_thread::yield();
      }
    }
  });

  for (size_t index = 1; index <= kBatchCount; ++index) {
    while (mailbox.consumeOne(9) ==
           blue::RealtimeChannelMailbox::ConsumeResult::Empty) {
      std::this_thread::yield();
    }
    require(value == static_cast<double>(index),
            "concurrent mailbox transfer must preserve FIFO publication");
  }
  producer.join();
}

} // namespace

int main() {
  try {
    testWholeBatchAndFifoApplication();
    testStaleGenerationIsDiscarded();
    testInputAndCapacityBounds();
    testConcurrentProducerConsumerOrdering();
    std::cout << "Realtime channel mailbox tests passed" << std::endl;
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "Realtime channel mailbox test failed: " << error.what()
              << std::endl;
    return 1;
  }
}
