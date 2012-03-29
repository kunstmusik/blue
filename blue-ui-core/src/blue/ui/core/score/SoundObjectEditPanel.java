package blue.ui.core.score;

import blue.plugin.BluePlugin;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.HashMap;

import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.SoundObjectEditor;
import blue.ui.core.BluePluginManager;
import java.util.ArrayList;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.util.Exceptions;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class SoundObjectEditPanel extends JComponent implements
        SelectionListener {
    JPanel editPanel = new JPanel();

    CardLayout cardLayout = new CardLayout();

    SoundObject currentSoundObject;

    HashMap<Class, Class> sObjEditorMap = new HashMap<Class, Class>();

    HashMap<Class, SoundObjectEditor> editors = new HashMap<Class, SoundObjectEditor>();

    JPanel emptyPanel = new JPanel();

    Border libraryBorder = new LineBorder(Color.GREEN);

    JLabel libraryEditLabel = new JLabel("Editing Library SoundObject");

    public SoundObjectEditPanel() {
        this.setLayout(new BorderLayout());
        editPanel.setLayout(cardLayout);
        this.add(editPanel, BorderLayout.CENTER);
        editPanel.add(emptyPanel, "none");

        libraryEditLabel.setOpaque(true);
        libraryEditLabel.setHorizontalAlignment(SwingConstants.CENTER);
        libraryEditLabel.setBackground(Color.GREEN);
        libraryEditLabel.setForeground(Color.BLACK);
        libraryEditLabel.setFont(new Font("dialog", Font.PLAIN, 10));

        this.add(libraryEditLabel, BorderLayout.NORTH);

        setEditingLibraryObject(false);


        ArrayList<BluePlugin> plugins = BluePluginManager.getInstance().getPlugins(SoundObjectEditor.class);

        for(BluePlugin plugin : plugins) {
            sObjEditorMap.put((Class)plugin.getProperty(BluePlugin.PROP_EDIT_CLASS),
                    plugin.getPluginClass());
        }
    }

    public void setEditingLibraryObject(boolean isLibaryObject) {
        if (isLibaryObject) {
            this.setBorder(libraryBorder);
        } else {
            this.setBorder(null);
        }
        this.libraryEditLabel.setVisible(isLibaryObject);
    }

    public void editSoundObject(SoundObject sObj) {
        if (currentSoundObject == sObj) {
            return;
        }

        currentSoundObject = sObj;

        cardLayout.show(editPanel, "none");
        if (sObj == null) {
            // JOptionPane.showMessageDialog(null, "yo");
            return;
        }

        SoundObject sObjToEdit = sObj;

        if (sObj instanceof Instance) {
            sObjToEdit = ((Instance) sObj).getSoundObject();
            this.setEditingLibraryObject(true);
        }

        Class sObjClass = sObjToEdit.getClass();
        Class sObjEditClass = null;

        for(Class c : sObjEditorMap.keySet()) {
            if(c.isAssignableFrom(sObjClass)) {
                sObjEditClass = sObjEditorMap.get(c);
                break;
            }
        }

        if(sObjEditClass == null) {
            DialogDisplayer.getDefault().notify(new NotifyDescriptor(
                    "Could not find editor for SoundObject of type: " + sObjClass.getCanonicalName(),
                    "Error",
                    NotifyDescriptor.DEFAULT_OPTION,
                    NotifyDescriptor.ERROR_MESSAGE, null, null));
            return;
        }

        SoundObjectEditor sObjEditor = editors.get(sObjEditClass);

        if(sObjEditor == null) {
            try {
                sObjEditor = (SoundObjectEditor) sObjEditClass.newInstance();
            } catch (InstantiationException ex) {
                Exceptions.printStackTrace(ex);
            } catch (IllegalAccessException ex) {
                Exceptions.printStackTrace(ex);
            }
            editors.put(sObjEditClass, sObjEditor);
            editPanel.add(sObjEditor, sObjEditClass.getName());
        }
        cardLayout.show(editPanel, sObjEditClass.getName());
        sObjEditor.editSoundObject(sObjToEdit);

//        Logger.getLogger(SoundObjectEditorTopComponent.class.getName()).fine("SoundObject Selected: " + className);;
    }

    public SoundObject getCurrentSoundObject() {
        return currentSoundObject;
    }

    public static void main(String args[]) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        SoundObjectEditPanel a = new SoundObjectEditPanel();

        a.editSoundObject(new blue.soundObject.PythonObject());

        mFrame.getContentPane().add(a);

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.event.SelectionListener#selectionPerformed(blue.event.SelectionEvent)
     */
    public void selectionPerformed(SelectionEvent e) {
        int selectionType = e.getSelectionType();

        if (selectionType == SelectionEvent.SELECTION_SINGLE) {
            editSoundObject((SoundObject) e.getSelectedItem());
        } else {
            editSoundObject(null);
        }

    }
}