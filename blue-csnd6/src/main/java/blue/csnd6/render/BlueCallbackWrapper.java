package blue.csnd6.render;

import com.kunstmusik.csoundjni.MessageCallback;
import java.io.IOException;

import org.openide.util.Exceptions;
import org.openide.windows.InputOutput;

public class BlueCallbackWrapper implements MessageCallback {

    InputOutput io = null;

    StringBuilder buffer = null;

    public void setInputOutput(InputOutput io) {
        if (this.io != null && io != null) {
            try {
//            this.io.closeInputOutput();
                this.io.getOut().reset();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        this.io = io;
    }

    public void setStringBuffer(StringBuilder buffer) {
        this.buffer = buffer;
    }

    @Override
    public void callback(int attr, String msg) {
        if (buffer != null) {
            buffer.append(msg);
        } else if (io == null) {
            System.out.print(msg);
            System.out.flush();
        } else {
            io.getOut().append(msg);
        }
    }
}
