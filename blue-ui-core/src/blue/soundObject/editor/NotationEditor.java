package blue.soundObject.editor;

import blue.soundObject.NotationObject;
import blue.soundObject.SoundObject;
import blue.soundObject.notation.NotationEditPoint;
import blue.soundObject.notation.NotationNote;
import blue.soundObject.notation.NotationStaffRenderer;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTextField;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

// notation view
// noteTemplate
// up, down - changes note pitch
// left, right - changes cursor location (place in note array)
// dot - adds dot, shift-dot removes dot
// +/- - sharpens or flats
public class NotationEditor extends SoundObjectEditor {
    NotationObject nObj = null;

    NotationStaffRenderer nStaffRenderer = new NotationStaffRenderer();

    NotationEditPoint nep = new NotationEditPoint();

    JScrollPane notationScrollPane = new JScrollPane();

    JPanel controlBar = new JPanel();

    JLabel noteTemplateLabel = new JLabel("note template: ");

    JTextField noteTemplateText = new JTextField();

    NotationOptionsMenu optionsMenu = new NotationOptionsMenu();

    public NotationEditor() {
        this.setLayout(new BorderLayout());

        // notationScrollPane.getViewport().add(nStaffRenderer);

        controlBar.setLayout(new BorderLayout());
        controlBar.add(noteTemplateLabel, BorderLayout.WEST);
        controlBar.add(noteTemplateText, BorderLayout.CENTER);

        // this.add(notationScrollPane, BorderLayout.CENTER);
        this.add(nStaffRenderer, BorderLayout.CENTER);
        this.add(controlBar, BorderLayout.SOUTH);
        nStaffRenderer.setRequestFocusEnabled(true);

        nStaffRenderer.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                nStaffRenderer.requestFocus();
                if (UiUtilities.isRightMouseButton(e)) {
                    showOptionsMenu(e.getX(), e.getY());
                }
            }

        });

        nStaffRenderer.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                System.out.println(e.getKeyCode());
                int keyCode = e.getKeyCode();
                switch (keyCode) {
                    case 37: // left
                        if (nep.getIndex() > 0) {
                            nep.setIndex(nep.getIndex() - 1);
                            nStaffRenderer.repaint();
                        }
                        break;
                    case 38: // top
                        nep.setMidiPch(nep.getMidiPch() + 1);
                        nStaffRenderer.repaint();
                        break;

                    case 39: // right
                        if (nep.getIndex() < nObj.getNotationStaff().size()) {
                            nep.setIndex(nep.getIndex() + 1);
                            nStaffRenderer.repaint();
                        }
                        break;

                    case 40: // bottom
                        nep.setMidiPch(nep.getMidiPch() - 1);
                        nStaffRenderer.repaint();
                        break;
                }
                if (keyCode > 48 && keyCode < 56) {
                    // range 49 - 54, corresponding to numbers 1 - 7
                    NotationNote tempNote = new NotationNote();
                    tempNote.setNoteDuration(keyCode - 48);
                    tempNote.setMidiPitch(nep.getMidiPch());
                    nObj.getNotationStaff().addNotationNote(tempNote);
                    nep.setIndex(nep.getIndex() + 1);
                    nStaffRenderer.repaint();
                }
            }
        });

    }

    private void showOptionsMenu(int x, int y) {
        optionsMenu.show(this, x, y);
    }

    @Override
    public void editSoundObject(SoundObject sObj) {
        if (sObj == null) {
            this.nObj = null;
            return;
        }

        if (!(sObj instanceof NotationObject)) {
            this.nObj = null;
            return;
        }

        this.nObj = (NotationObject) sObj;
        nStaffRenderer.setNotationStaff(this.nObj.getNotationStaff());
        nep.setIndex(0);
        nStaffRenderer.setNotationEditPoint(nep);
    }
}

class NotationOptionsMenu extends JPopupMenu implements ActionListener {
    NotationEditor nEditor;

    JMenuItem bassClef = new JMenuItem("Bass Clef");

    JMenuItem trebleClef = new JMenuItem("Treble Clef");

    public NotationOptionsMenu() {
        JMenu clefChange = new JMenu("Change Clef");
        clefChange.setMnemonic('C');
        this.add(clefChange);

        clefChange.add(trebleClef);
        clefChange.add(bassClef);

        trebleClef.addActionListener(this);
        bassClef.addActionListener(this);
    }

    public void show(NotationEditor nEditor, int x, int y) {
        this.nEditor = nEditor;
        super.show(nEditor, x, y);
    }

    @Override
    public void actionPerformed(ActionEvent ae) {
        String command = ae.getActionCommand();
        switch (command) {
            case "Bass Clef":
                break;
            case "Treble Clef":

                break;
        }
    }

}