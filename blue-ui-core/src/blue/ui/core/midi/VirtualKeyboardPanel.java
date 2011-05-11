/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2011 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.core.midi;

import blue.gui.TimedKeyListener;
import blue.midi.MidiInputManager;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.ShortMessage;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;

/**
 *
 * @author syi
 */
public class VirtualKeyboardPanel extends JComponent {

    private static final int KEY_OFFSET = 21;
    AtomicBoolean[] keyStates = new AtomicBoolean[88];
    AtomicBoolean[] changedKeyStates = new AtomicBoolean[88];
    int[] whiteKeys = new int[7];
    int lastMidiKey = -1;
    int octave = 5;
    MidiInputManager midiEngine = MidiInputManager.getInstance();

    public VirtualKeyboardPanel() {
        
        setFocusable(true);
        
        for (int i = 0; i < 88; i++) {
            keyStates[i] = new AtomicBoolean(false);
            changedKeyStates[i] = new AtomicBoolean(false);
        }

        whiteKeys[0] = 0;
        whiteKeys[1] = 2;
        whiteKeys[2] = 4;
        whiteKeys[3] = 5;
        whiteKeys[4] = 7;
        whiteKeys[5] = 9;
        whiteKeys[6] = 11;

        this.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent me) {

                if (SwingUtilities.isLeftMouseButton(me)) {

                    int key = getMIDIKey(me.getX(), me.getY());

                    lastMidiKey = key;

                    keyStates[key].set(true);


                    try {
                        ShortMessage sme = new ShortMessage();
                        sme.setMessage(ShortMessage.NOTE_ON, key + KEY_OFFSET, 100);

                        midiEngine.send(sme, 0L);

                    } catch (InvalidMidiDataException ex) {
                        Exceptions.printStackTrace(ex);
                    }

                    requestFocus();

                    repaint();
                }
            }

            public void mouseReleased(MouseEvent me) {

                if (SwingUtilities.isLeftMouseButton(me)) {

                    int key = getMIDIKey(me.getX(), me.getY());

                    if (key > 87) {
                        key = 87;
                    }

                    keyStates[key].set(false);

                    keyStates[lastMidiKey].compareAndSet(true, false);

                    lastMidiKey = -1;

                    try {

                        ShortMessage sme = new ShortMessage();
                        sme.setMessage(ShortMessage.NOTE_OFF, key + KEY_OFFSET, 100);

                        midiEngine.send(sme, 0L);

                    } catch (InvalidMidiDataException ex) {
                        Exceptions.printStackTrace(ex);
                    }

                    repaint();

                }
            }
        });

        this.addMouseMotionListener(new MouseMotionAdapter() {

            public void mouseDragged(MouseEvent me) {
                if (SwingUtilities.isLeftMouseButton(me)) {
                    int key = getMIDIKey(me.getX(), me.getY());

                    if (key > 87) {
                        key = 87;
                    }

                    if (key != lastMidiKey) {

                        keyStates[lastMidiKey].set(false);

                        keyStates[key].compareAndSet(false, true);


                        try {

                            ShortMessage sme = new ShortMessage();

                            sme.setMessage(ShortMessage.NOTE_OFF, lastMidiKey + KEY_OFFSET, 100);
                            midiEngine.send(sme, 0L);

                            sme.setMessage(ShortMessage.NOTE_ON, key + KEY_OFFSET, 100);
                            midiEngine.send(sme, 0L);

                        } catch (InvalidMidiDataException ex) {
                            Exceptions.printStackTrace(ex);
                        }

                        lastMidiKey = key;

                        repaint();

                    }
                }
            }
        });

        this.addKeyListener(new TimedKeyListener() {

            @Override
            public void KeyPressed(KeyEvent e) {
                handleKey(e.getKeyChar(), true);
            }

            @Override
            public void KeyReleased(KeyEvent e) {
                handleKey(e.getKeyChar(), false);
            }
        });

    }

    @Override
    public void paint(Graphics g) {

        int whiteKeyHeight = this.getHeight();
        int blackKeyHeight = (int) (whiteKeyHeight * .625);
        float whiteKeyWidth = this.getWidth() / 52.0f;
        int blackKeyWidth = (int) (whiteKeyWidth * .8333333);
        int blackKeyOffset = blackKeyWidth / 2;

        float runningX = 0;
        int yval = 0;


        g.setColor(Color.WHITE);
        g.fillRect(0, 0, getWidth(), getHeight());

        g.setColor(Color.BLACK);
        g.drawRect(0, 0, getWidth(), getHeight());


        int lineHeight = whiteKeyHeight - 1;

        // Draw White Keys
        for (int i = 0; i < 88; i++) {
            if (isWhiteKey(i)) {
                int newX = (int) (runningX + 0.5);

                if (keyStates[i].get()) {
                    int newW = (int) ((runningX + whiteKeyWidth + 0.5) - newX);
                    g.setColor(Color.BLUE);
                    g.fillRect(newX, yval, newW, whiteKeyHeight - 1);
                }

                runningX += whiteKeyWidth;

                g.setColor(Color.BLACK);

                g.drawLine(newX, 0, newX, lineHeight);
            }
        }

        runningX = 0.0f;

        // Draw Black Keys
        for (int i = 0; i < 88; i++) {
            if (isWhiteKey(i)) {
                runningX += whiteKeyWidth;
            } else {
                if (keyStates[i].get()) {
                    g.setColor(Color.BLUE);
                    g.fillRect((int) (runningX - blackKeyOffset), yval, blackKeyWidth, blackKeyHeight);
                } else {
                    g.setColor(Color.BLACK);
                    g.fillRect((int) (runningX - blackKeyOffset), yval, blackKeyWidth, blackKeyHeight);
                }
                g.setColor(Color.BLACK);
                g.drawRect((int) (runningX - blackKeyOffset), yval, blackKeyWidth, blackKeyHeight);
            }
        }
    }

    int getMidiValForWhiteKey(int whiteKeyNum) {
        if (whiteKeyNum < 2) {
            return whiteKeyNum * 2;
        }

        int adjusted = whiteKeyNum - 2;

        int oct = adjusted / 7;
        int key = adjusted % 7;

        return 3 + (oct * 12) + whiteKeys[key];
    }

    int getMIDIKey(int x, int y) {

        if (x >= this.getWidth()) {
            return 87;
        }

        if (x < 0) {
            return 0;
        }

        int whiteKeyHeight = this.getHeight();
        int blackKeyHeight = (int) (whiteKeyHeight * .625);

        float whiteKeyWidth = this.getWidth() / 52.0f;
        float blackKeyWidth = whiteKeyWidth * .8333333f;

        float leftKeyBound = blackKeyWidth / 2.0f;
        float rightKeyBound = whiteKeyWidth - leftKeyBound;


        // 52 white keys
        int whiteKey = (int) (x / whiteKeyWidth);

        float extra = x - (whiteKey * whiteKeyWidth);

        if (whiteKey < 2) {
            if (whiteKey == 0) {
                if (y > blackKeyHeight) {
                    return whiteKey;
                } else {
                    if (extra > rightKeyBound) {
                        return whiteKey + 1;
                    }
                    return whiteKey;
                }
            } else {
                if (y > blackKeyHeight) {
                    return getMidiValForWhiteKey(whiteKey);
                } else {
                    if (extra < leftKeyBound) {
                        return getMidiValForWhiteKey(whiteKey) - 1;
                    }
                    return getMidiValForWhiteKey(whiteKey);
                }
            }
        }

        int adjustedKey = (whiteKey - 2) % 7;

        if (adjustedKey == 0 || adjustedKey == 3) {

            if (y > blackKeyHeight) {
                return getMidiValForWhiteKey(whiteKey);
            } else {
                if (extra > rightKeyBound) {
                    return getMidiValForWhiteKey(whiteKey) + 1;
                }
                return getMidiValForWhiteKey(whiteKey);
            }

        } else if (adjustedKey == 2 || adjustedKey == 6) {

            if (y > blackKeyHeight) {
                return getMidiValForWhiteKey(whiteKey);
            } else {
                if (extra < leftKeyBound) {
                    return getMidiValForWhiteKey(whiteKey) - 1;
                }
                return getMidiValForWhiteKey(whiteKey);
            }

        }

        if (y > blackKeyHeight) {
            return getMidiValForWhiteKey(whiteKey);
        }

        if (extra < leftKeyBound) {
            return getMidiValForWhiteKey(whiteKey) - 1;
        }

        if (extra > rightKeyBound) {
            return getMidiValForWhiteKey(whiteKey) + 1;
        }

        return getMidiValForWhiteKey(whiteKey);

    }

    boolean isWhiteKey(int key) {

        if (key < 3) {
            return (key % 2) == 0;
        }

        int adjustedKey = (key - 3) % 12;

        switch (adjustedKey) {
            case 0:
            case 2:
            case 4:
            case 5:
            case 7:
            case 9:
            case 11:
                return true;
        }

        return false;

    }

    protected void handleKey(char key, boolean keyDown) {

        int index = -1;

        switch (key) {
            case 'z':
                index = 0;
                break;
            case 's':
                index = 1;
                break;
            case 'x':
                index = 2;
                break;
            case 'd':
                index = 3;
                break;
            case 'c':
                index = 4;
                break;
            case 'v':
                index = 5;
                break;
            case 'g':
                index = 6;
                break;
            case 'b':
                index = 7;
                break;
            case 'h':
                index = 8;
                break;
            case 'n':
                index = 9;
                break;
            case 'j':
                index = 10;
                break;
            case 'm':
                index = 11;
                break;
            case 'q':
                index = 12;
                break;
            case '2':
                index = 13;
                break;
            case 'w':
                index = 14;
                break;
            case '3':
                index = 15;
                break;
            case 'e':
                index = 16;
                break;
            case 'r':
                index = 17;
                break;
            case '5':
                index = 18;
                break;
            case 't':
                index = 19;
                break;
            case '6':
                index = 20;
                break;
            case 'y':
                index = 21;
                break;
            case '7':
                index = 22;
                break;
            case 'u':
                index = 23;
                break;
            case 'i':
                index = 24;
                break;
            case '9':
                index = 25;
                break;
            case 'o':
                index = 26;
                break;
            case '0':
                index = 27;
                break;
            case 'p':
                index = 28;
                break;
            default:
                return;
        }

        if (index < 0) {
            return;
        }

        index = ((octave * 12) + index) - 21;

        if (index < 0 || index > 87) {
            return;
        }

        if (keyStates[index].get() != keyDown) {
            keyStates[index].set(keyDown);

            try {
                ShortMessage sme = new ShortMessage();
                
                int state = keyDown ? ShortMessage.NOTE_ON : ShortMessage.NOTE_OFF;
                
                sme.setMessage(state, index + KEY_OFFSET, 100);

                midiEngine.send(sme, 0L);

            } catch (InvalidMidiDataException ex) {
                Exceptions.printStackTrace(ex);
            }

            repaint();
        }
    }
}

