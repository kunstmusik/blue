/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.ui.core.score;

import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorChainMap;
import com.l2fprod.common.swing.BaseDialog;
import java.awt.BorderLayout;
import java.awt.Container;
import java.awt.Frame;
import org.openide.windows.WindowManager;

public class NoteProcessorDialog extends BaseDialog {

    NoteProcessorChainEditor npcEditor = new NoteProcessorChainEditor();

    private static NoteProcessorDialog instance = null;

    public static NoteProcessorDialog getInstance() {
        if(instance == null) {
            instance = new NoteProcessorDialog(
                    WindowManager.getDefault().getMainWindow());
        }
        return instance;
    }

    public NoteProcessorDialog(Frame owner) {
        super(owner, "Note Processor Chain Editor", true);
        this.setDialogMode(BaseDialog.CLOSE_DIALOG);

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(npcEditor, BorderLayout.CENTER);

        this.getBanner().setVisible(false);

        this.setSize(400, 600);
        this.centerOnScreen();
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        npcEditor.setNoteProcessorChain(npc);
    }

    public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
        npcEditor.setNoteProcessorChainMap(npcMap);
    }

}
