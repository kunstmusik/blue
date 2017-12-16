/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.csnd6.render;

import java.util.concurrent.atomic.AtomicInteger;

/**
 *
 * @author stevenyi
 */
public class MessageBuffer {

    private final int capacity;
    private final Message[] messages;
    private int readStartIndex = 0;
    private final AtomicInteger readEndIndex = new AtomicInteger();
    private final AtomicInteger getIndex = new AtomicInteger();
    private final AtomicInteger putIndex = new AtomicInteger();

    public MessageBuffer() {
        this(512);
    }

    public MessageBuffer(int initialCapacity) {
        this.capacity = initialCapacity;
        messages = new Message[initialCapacity];
        for (int i = 0; i < initialCapacity; i++) {
            messages[i] = new Message();
        }
    }

    private static int getAndIncrementWithModulus(AtomicInteger aInt, int modulus) {
        int getVal;
        int newVal;

        do {
            getVal = aInt.get();

            newVal = (getVal + 1);
            if (newVal == modulus) {
                newVal = 0;
            }
        } while (!aInt.compareAndSet(getVal, newVal));

        return getVal;
    }

    public void postMessage(int msgType, String msg) {
        Message m = messages[getAndIncrementWithModulus(getIndex, capacity)];
        m.setMessage(msgType, msg);
        messages[getAndIncrementWithModulus(putIndex, capacity)] = m;
        getAndIncrementWithModulus(readEndIndex, capacity);
    }

    public boolean isEmpty() {
        return readStartIndex == readEndIndex.get();
    }

    public int getReadStart() {
        return readStartIndex;
    }

    public void setReadStart(int start) {
        readStartIndex = start;
    }

    public int getReadEnd() {
        return readEndIndex.get();
    }

    public Message getMessage(int index) {
        return messages[index];
    }

    public int getCapacity() {
        return capacity;
    }

}
