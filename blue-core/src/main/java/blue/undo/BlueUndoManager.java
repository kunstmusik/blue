package blue.undo;

import blue.BlueSystem;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.HashMap;
import javax.swing.JMenuItem;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class BlueUndoManager {

    private static HashMap<String, UndoManager> undoGroup;

    private static UndoManager undo;

    private static JMenuItem undoMenuItem;

    private static JMenuItem redoMenuItem;

    private static ActionListener al;

    static {
        al = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (e.getSource() == undoMenuItem) {
                    if (undo.canUndo()) {
                        undo.undo();
                        checkMenus();
                    }
                } else if (e.getSource() == redoMenuItem) {
                    if (undo.canRedo()) {
                        undo.redo();
                        checkMenus();
                    }
                }
            }
        };
    }

    public static ActionListener getMenuActionListener() {
        return al;
    }

    public static void setUndoGroup(HashMap<String,UndoManager> _undoGroup) {
        undoGroup = _undoGroup;
    }

    public static void setUndoManager(String tab) {
        Object obj = undoGroup.get(tab);

        if (obj == null) {
            UndoManager manager = new NoStyleChangeUndoManager();
            manager.setLimit(1000);

            undoGroup.put(tab, manager);

            obj = manager;
        }

        undo = (UndoManager) obj;

        checkMenus();
    }

    public static UndoManager getUndoManager() {
        return undo;
    }

    public static void setUndoMenuItem(JMenuItem _undoMenuItem) {
        undoMenuItem = _undoMenuItem;
    }

    public static void setRedoMenuItem(JMenuItem _redoMenuItem) {
        redoMenuItem = _redoMenuItem;
    }

    public static void addEdit(UndoableEdit edit) {
        if (undo != null) {
            // if (edit.getPresentationName().equals("style change")) {
            // return;
            // throw away, not necessary for undoing and hilighting of text
            // }
            undo.addEdit(edit);
            checkMenus();
        }
    }

    private static void checkMenus() {
        if (undo == null) {
            return;
        }

        if (undoMenuItem != null) {
            if (undo.canUndo()) {
                undoMenuItem.setEnabled(true);
                undoMenuItem.setText(undo.getUndoPresentationName());
            } else {
                undoMenuItem.setEnabled(false);
                undoMenuItem.setText(BlueSystem.getString("undo.undo"));
            }
        }

        if (redoMenuItem != null) {
            if (undo.canRedo()) {
                redoMenuItem.setEnabled(true);
                redoMenuItem.setText(undo.getRedoPresentationName());
            } else {
                redoMenuItem.setEnabled(false);
                redoMenuItem.setText(BlueSystem.getString("undo.redo"));
            }
        }

    }

}