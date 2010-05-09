package blue.orchestra.editor;

import javax.swing.JComponent;

import blue.orchestra.Instrument;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public abstract class InstrumentEditor extends JComponent {
    public abstract Class getInstrumentClass();
    public abstract void editInstrument(Instrument instr);
}