package blue.orchestra.editor;

import blue.orchestra.Instrument;
import javax.swing.JComponent;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public abstract class InstrumentEditor extends JComponent {
    public abstract void editInstrument(Instrument instr);
}