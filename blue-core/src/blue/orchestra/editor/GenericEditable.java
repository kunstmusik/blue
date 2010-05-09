package blue.orchestra.editor;

import blue.udo.OpcodeList;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public interface GenericEditable {
    public String getText();

    public void setText(String text);

    public String getGlobalOrc();

    public void setGlobalOrc(String globalOrc);

    public String getGlobalSco();

    public void setGlobalSco(String globalSco);

    public OpcodeList getOpcodeList();
}