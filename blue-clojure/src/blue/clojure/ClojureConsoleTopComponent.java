/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure;

import blue.projects.BlueProjectManager;
import blue.ui.utilities.jconsole.JConsole;
import blue.ui.utilities.jconsole.JConsoleDelegate;
import java.awt.BorderLayout;
import java.io.Reader;
import java.io.Writer;
import java.util.HashMap;
import java.util.Map;
import javax.swing.JScrollPane;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.util.Exceptions;
import org.openide.windows.TopComponent;
import org.openide.util.NbBundle.Messages;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(
        dtd = "-//blue.clojure//ClojureConsole//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "ClojureConsoleTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "output", openAtStartup = false)
@ActionID(category = "Window", id = "blue.clojure.ClojureConsoleTopComponent")
@ActionReference(path = "Menu/Window", position = 1910)
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_ClojureConsoleAction",
        preferredID = "ClojureConsoleTopComponent"
)
@Messages({
    "CTL_ClojureConsoleAction=Clojure REPL",
    "CTL_ClojureConsoleTopComponent=Clojure REPL",
    "HINT_ClojureConsoleTopComponent=REPL for evaluating Clojure code"
})
public final class ClojureConsoleTopComponent extends TopComponent {

    JConsole jconsole = new JConsole();

    public ClojureConsoleTopComponent() {
        initComponents();
        setName(Bundle.CTL_ClojureConsoleTopComponent());
        setToolTipText(Bundle.HINT_ClojureConsoleTopComponent());

        this.add(new JScrollPane(jconsole), BorderLayout.CENTER);

        final JConsoleDelegate jConsoleDelegate = new JConsoleDelegate() {
            @Override
            public String getPrompt() {
                return BlueClojureEngine.getInstance().getCurrentNameSpace() + "=> ";
            }

            @Override
            public void processCommands(String commands, Reader stdin, Writer stdout, Writer stderr) {

                Map<String, Object> values = new HashMap<>();
                values.put("*in*", stdin);
                values.put("*out*", stdout);
                values.put("*err*", stderr);
                try {
                    String retVal = BlueClojureEngine.getInstance().processScript(commands,
                            null,
                            null);
                    stdout.write(retVal + "\n");
                } catch (Exception ex) {
                    Exceptions.printStackTrace(ex);
                }
            }
        };

        jconsole.setDelegate(jConsoleDelegate);

        BlueProjectManager.getInstance().addPropertyChangeListener(pce -> {

            if (BlueProjectManager.CURRENT_PROJECT.equals(pce.getPropertyName())) {
                jconsole.setText(jConsoleDelegate.getPrompt());
            }
        });
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        setLayout(new java.awt.BorderLayout());
    }// </editor-fold>//GEN-END:initComponents

    // Variables declaration - do not modify//GEN-BEGIN:variables
    // End of variables declaration//GEN-END:variables
    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        // better to version settings since initial version as advocated at
        // http://wiki.apidesign.org/wiki/PropertyFiles
        p.setProperty("version", "1.0");
        // TODO store your settings
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
        // TODO read your settings according to their version
    }
}
