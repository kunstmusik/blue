package blue.ui.core.orchestra;

import blue.orchestra.Instrument;
import blue.orchestra.editor.InstrumentEditor;
import blue.plugin.BluePlugin;
import blue.ui.core.BluePluginManager;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Font;
import java.util.ArrayList;
import java.util.HashMap;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.SwingConstants;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import org.openide.util.Exceptions;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class InstrumentEditPanel extends JComponent {

    JPanel editPanel = new JPanel();

    HashMap<Class, Class> instrEditorMap = new HashMap<>();

    HashMap<Class, InstrumentEditor> editors = new HashMap<>();

    CardLayout cardLayout = new CardLayout();

    Instrument currentInstrument = null;

    JTextArea commentPane = new JTextArea();

    Border libraryBorder = new LineBorder(Color.GREEN);

    JLabel libraryEditLabel = new JLabel("Editing Library Instrument");

    public InstrumentEditPanel() {
        this.setLayout(new BorderLayout());

        JTabbedPane tabs = new JTabbedPane();

        tabs.add("Instrument Editor", editPanel);
        tabs.add("Comments", new JScrollPane(commentPane));

        commentPane.setWrapStyleWord(true);
        commentPane.setLineWrap(true);

        editPanel.setLayout(cardLayout);

        libraryEditLabel.setOpaque(true);
        libraryEditLabel.setHorizontalAlignment(SwingConstants.CENTER);
        libraryEditLabel.setBackground(Color.GREEN);
        libraryEditLabel.setForeground(Color.BLACK);
        libraryEditLabel.setFont(new Font("dialog", Font.PLAIN, 10));

        this.add(libraryEditLabel, BorderLayout.NORTH);
        this.add(tabs, BorderLayout.CENTER);

        editPanel.add(new JPanel(), "none");

        commentPane.getDocument().addDocumentListener(new DocumentListener() {
            @Override
            public void insertUpdate(DocumentEvent e) {
                updateComment();
            }

            @Override
            public void removeUpdate(DocumentEvent e) {
                updateComment();
            }

            @Override
            public void changedUpdate(DocumentEvent e) {
                updateComment();
            }

            private void updateComment() {
                if (currentInstrument != null) {
                    currentInstrument.setComment(commentPane.getText());
                }
            }
        });

        setEditingLibraryObject(false);

        ArrayList<BluePlugin> plugins = BluePluginManager.getInstance().getPlugins(InstrumentEditor.class);

        for(BluePlugin plugin : plugins) {
            instrEditorMap.put((Class)plugin.getProperty(BluePlugin.PROP_EDIT_CLASS),
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

    public void editInstrument(Instrument instr) {
        if (currentInstrument == instr) {
            return;
        }

        currentInstrument = instr;

        if (instr == null) {
            commentPane.setText("");
            cardLayout.show(editPanel, "none");
            commentPane.setEnabled(false);

            return;
        }

        commentPane.setEnabled(true);
        commentPane.setText(instr.getComment());


        Class instrClass = instr.getClass();
        Class instrEditorClass = null;

        for(Class c : instrEditorMap.keySet()) {
            if(c.isAssignableFrom(instrClass)) {
                instrEditorClass = instrEditorMap.get(c);
                break;
            }
        }

        InstrumentEditor instrEditor = editors.get(instrEditorClass);

        if(instrEditor == null) {
            try {
                instrEditor = (InstrumentEditor) instrEditorClass.newInstance();
            } catch (    InstantiationException | IllegalAccessException ex) {
                Exceptions.printStackTrace(ex);
            }
            editors.put(instrEditorClass, instrEditor);
            editPanel.add(instrEditor, instrEditorClass.getName());
        } 

        cardLayout.show(editPanel, instrEditor.getClass().getCanonicalName());
        instrEditor.editInstrument(instr);
        
    }

//    public static void main(String args[]) {
//        JFrame mFrame = new JFrame();
//        mFrame.setSize(800, 600);
//        InstrumentEditPanel a = new InstrumentEditPanel();
//
//        // a.editInstrument(new blue.Instrument.PythonObject());
//
//        mFrame.getContentPane().add(a);
//
//        mFrame.show();
//        mFrame.addWindowListener(new WindowAdapter() {
//
//            public void windowClosing(WindowEvent e) {
//                System.exit(0);
//            }
//        });
//    }

}