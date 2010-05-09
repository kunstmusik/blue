/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor.jmask;

import blue.soundObject.SoundObjectEvent;
import java.awt.Dimension;
import java.awt.Rectangle;
import java.awt.event.ContainerEvent;
import java.awt.event.ContainerListener;

import javax.swing.JComponent;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

import blue.soundObject.SoundObjectListener;
import blue.soundObject.JMask;
import blue.soundObject.jmask.Field;
import blue.soundObject.jmask.Generator;
import blue.soundObject.jmask.Parameter;
import java.util.Vector;
import javax.swing.Scrollable;

/**
 * 
 * @author steven
 */
public class EditorListPanel extends JComponent implements
        ParameterEditListener, ListDataListener, Scrollable, SoundObjectListener {

    JMask jMask = null;
    Field field = null;

    /** Creates a new instance of EditorListPanel */
    public EditorListPanel() {
        this.setLayout(new JMaskEditorLayout());

        this.addContainerListener(new ContainerListener() {

            public void componentAdded(ContainerEvent e) {
                EditorListPanel.this.setSize(EditorListPanel.this.getPreferredSize());
            }

            public void componentRemoved(ContainerEvent e) {
                EditorListPanel.this.setSize(EditorListPanel.this.getPreferredSize());
            }
        });
    }

    public void setJMask(JMask jMask) {

        cleanUp();

        field = jMask.getField();

        for (int i = 0; i < field.getSize(); i++) {
            Parameter p = field.getParameter(i);

            ParameterEditor pEditor = new ParameterEditor();

            pEditor.setParameter(p, i + 1);
            this.add(pEditor);

            pEditor.setDuration((double) jMask.getSubjectiveDuration());

            pEditor.addParameterEditListener(this);
        }

        field.addListDataListener(this);
        
        jMask.addSoundObjectListener(this);
        
        this.jMask = jMask;

        revalidate();
    }

    public void parameterEdit(int editType, int parameterNum,
            Generator generator) {
        int index = parameterNum - 1;

        switch (editType) {
            case ParameterEditListener.PARAMETER_ADD_BEFORE:
                field.addParameterBefore(index, generator);
                break;
            case ParameterEditListener.PARAMETER_ADD_AFTER:
                field.addParameterAfter(index, generator);
                break;
            case ParameterEditListener.PARAMETER_REMOVE:
                field.removeParameter(index);
                break;
            case ParameterEditListener.PARAMETER_CHANGE_TYPE:
                field.changeParameter(index, generator);
                break;
            case ParameterEditListener.PARAMETER_PUSH_UP:
                field.pushUp(index);
                break;
            case ParameterEditListener.PARAMETER_PUSH_DOWN:
                field.pushDown(index);
                break;
            default:
                System.err.println("Error with Parameter Edit in EditorListPanel");
                break;
        }
    }

    // List Data Events
    public void intervalAdded(ListDataEvent e) {
        int index = e.getIndex0();

        Parameter param = this.field.getParameter(index);

        ParameterEditor pEditor = new ParameterEditor();
        pEditor.setParameter(param, index + 1);
        pEditor.addParameterEditListener(this);

        this.add(pEditor, index);
        
        pEditor.setDuration((double)jMask.getSubjectiveDuration());

        renumberParameterPanels();
        revalidate();

    }

    public void intervalRemoved(ListDataEvent e) {
        int index = e.getIndex0();

        ParameterEditor pEditor = (ParameterEditor) this.getComponent(index);
        pEditor.removeParameterEditListener(this);

        this.remove(index);

        renumberParameterPanels();
        revalidate();
    }

    public void contentsChanged(ListDataEvent e) {
        for(int index = e.getIndex0(); index <= e.getIndex1(); index++) {
            ParameterEditor pEditor = (ParameterEditor) this.getComponent(index);
            pEditor.removeParameterEditListener(this);

            this.remove(index);

            Parameter param = this.field.getParameter(index);

            pEditor = new ParameterEditor();
            pEditor.setParameter(param, index + 1);
            pEditor.addParameterEditListener(this);

            this.add(pEditor, index);

            pEditor.setDuration(jMask.getSubjectiveDuration());
        }
        
        renumberParameterPanels();
        revalidate();
    }

    private void cleanUp() {

        if (this.field != null) {
            this.field.removeListDataListener(this);

            for (int i = 0; i < getComponentCount(); i++) {
                ParameterEditor pEditor = (ParameterEditor) getComponent(i);
                pEditor.removeParameterEditListener(this);
            }

        }

        if (this.jMask != null) {
            this.jMask.removeSoundObjectListener(this);
        }

        this.field = null;
        this.jMask = null;

        removeAll();
    }

    private void renumberParameterPanels() {
        for (int i = 0; i < getComponentCount(); i++) {
            ParameterEditor pEditor = (ParameterEditor) getComponent(i);
            pEditor.setParameterNumber(i + 1);
        }
    }

    public void soundObjectChanged(SoundObjectEvent event) {
        if(event.getPropertyChanged() == SoundObjectEvent.DURATION) {            
            for (int i = 0; i < getComponentCount(); i++) {
                ParameterEditor pEditor = (ParameterEditor) getComponent(i);
                pEditor.setDuration(this.jMask.getSubjectiveDuration());
            }
        }
    }

    public Dimension getPreferredScrollableViewportSize() {
        return new Dimension(0, 0);
    }

    public int getScrollableUnitIncrement(Rectangle visibleRect, int orientation, int direction) {
        return 20;
    }

    public int getScrollableBlockIncrement(Rectangle visibleRect, int orientation, int direction) {
        return 20;
    }

    public boolean getScrollableTracksViewportWidth() {
        return true;
    }

    public boolean getScrollableTracksViewportHeight() {
        return false;
    }
}
