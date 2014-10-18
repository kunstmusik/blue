/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
/**
 * Code found at http://www.arco.in-berlin.de/keyevent.html
 */
package blue.gui;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.util.TreeSet;
import javax.swing.Timer;

public class TimedKeyListener
        implements KeyListener,
        ActionListener {

    private final TreeSet<Integer> set = new TreeSet<Integer>();
    private final Timer timer;
    private KeyEvent releaseEvent;
    private boolean gameModus = false;

    private void fireKeyReleased(KeyEvent e) {
        if (set.remove(new Integer(e.getKeyCode()))) {
            KeyReleased(e);
        }
    }

    public TimedKeyListener() {
        this(false);
    }

    public TimedKeyListener(boolean gameModus) {
        this.gameModus = gameModus;
        timer = new Timer(0, this);
    }

    public void KeyPressed(KeyEvent e) {
    }

    public void KeyReleased(KeyEvent e) {
    }

    public void KeyTyped(KeyEvent e) {
    }

    public int getPressedCount() {
        return set.size();
    }

    public void keyPressed(KeyEvent e) {
        if (timer.isRunning()) {
            timer.stop();
        } else {
            if (set.add(new Integer(e.getKeyCode()))) {
                if (gameModus) {
                    KeyPressed(e);
                    return;
                }
            }
        }
        if (!gameModus) {
            KeyPressed(e);
        }
    }

    public void keyReleased(KeyEvent e) {
        if (timer.isRunning()) {
            timer.stop();
            fireKeyReleased(e);
        } else {
            releaseEvent = e;
            timer.restart();
        }
    }

    public void keyTyped(KeyEvent e) {
        KeyTyped(e);
    }

    public void actionPerformed(ActionEvent e) {
        timer.stop();
        fireKeyReleased(releaseEvent);
    }
}