/*
 * ClassByteOutputStream.java
 *
 * Created on September 12, 2005, 8:27 AM
 *
 * To change this template, choose Tools | Options and locate the template under
 * the Source Creation and Management node. Right-click the template and choose
 * Open. You can then make changes to the template in the Source Editor.
 */

package blue.utility;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Implementation of ByteArrayOutputStream the takes an input stream as its ctor
 * argument and copies that stream into its stream
 * 
 * @author mbechard
 */
public class ClassByteOutputStream extends ByteArrayOutputStream {

    /** Creates a new instance of ClassByteOutputStream */
    public ClassByteOutputStream(InputStream stream) throws IOException {
        super();
        copy(stream);
    }

    /**
     * Copies an input stream into this output stream
     * 
     * @param in
     *            InputStream to copy into this stream
     * @throws java.io.IOException
     *             From the read and write function calls
     */
    protected void copy(InputStream in) throws IOException {
        byte[] buf = new byte[1024];
        while (true) {
            int len = in.read(buf);
            if (len < 0) {
                break;
            }
            write(buf, 0, len);
        }
    }

}
