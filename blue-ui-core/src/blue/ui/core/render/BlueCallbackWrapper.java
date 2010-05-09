package blue.ui.core.render;


import java.io.IOException;
import org.apache.commons.lang.text.StrBuilder;

import csnd.Csound;
import csnd.CsoundCallbackWrapper;
import org.openide.util.Exceptions;
import org.openide.windows.InputOutput;

public class BlueCallbackWrapper extends CsoundCallbackWrapper {

    InputOutput io = null;

    StrBuilder buffer = null;

    public BlueCallbackWrapper(Csound csound) {
        super(csound);

    }

    @Override
    public void MessageCallback(int arg0, String arg1) {
        if (buffer != null) {
            buffer.append(arg1);
        } else if (io == null) {
            System.out.print(arg1);
            System.out.flush();
        } else {
            io.getOut().append(arg1);
        }
    }
    
    public void setInputOutput(InputOutput io) {
        if(this.io != null && io != null) {
            try {
//            this.io.closeInputOutput();
                this.io.getOut().reset();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        this.io = io;
    }
    
    public void setStringBuffer(StrBuilder buffer) {
        this.buffer = buffer;
    }
}
