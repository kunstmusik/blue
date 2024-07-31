package blue.csnd6.render;

import com.kunstmusik.csoundffm.MessageCallback;
import java.io.IOException;
import java.lang.foreign.MemorySegment;

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
    public void callback(MemorySegment csound, int attr, MemorySegment msg) {
        
        String msgText = msg.reinterpret(Integer.MAX_VALUE).getString(0);
        
        if (buffer != null) {
            buffer.append(msgText);
        } else if (io == null) {
            System.out.print(msgText);
            System.out.flush();
        } else {
            io.getOut().append(msgText);
        }
    }
}
