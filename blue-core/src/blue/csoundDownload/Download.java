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
package blue.csoundDownload;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLConnection;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class Download implements Runnable {

    Vector listeners = new Vector();

    private final String fileToDownload;

    private final ChangeEvent event;

    boolean complete = false;

    public Download(String fileToDownload) {
        this.fileToDownload = fileToDownload;

        this.event = new ChangeEvent(this);
    }

    public void run() {
        try {
            URLConnection conn = new URL(fileToDownload).openConnection();

            InputStream in = null;
            FileOutputStream out = null;

            int bufferSize = 4096;

            byte[] buffer = new byte[bufferSize];
            int n;
            long copied = 0;
            while (-1 != (n = in.read(buffer))) {
                out.write(buffer, 0, n);
                copied += n;

                fireChange();
            }

        } catch (MalformedURLException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        complete = true;

    }

    public void addChangeListener(ChangeListener cl) {
        listeners.add(cl);
    }

    private void fireChange() {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            ChangeListener l = (ChangeListener) iter.next();
            l.stateChanged(event);
        }
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        // TODO Auto-generated method stub

    }

}
