/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
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
package blue.ui.core.script.javascript;

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.scripting.JavaScriptProxy;
import blue.scripting.JavaScriptProxyListener;
import blue.ui.utilities.jconsole.JConsole;
import blue.ui.utilities.jconsole.JConsoleDelegate;
import java.awt.BorderLayout;
import java.beans.PropertyChangeEvent;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import javax.script.ScriptException;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.util.Exceptions;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.TopComponent;

@ConvertAsProperties(
        dtd = "-//blue.ui.core.script.javascript//JavaScriptConsole//EN",
        autostore = false)
@TopComponent.Description(
        preferredID = "JavaScriptConsoleTopComponent",
        persistenceType = TopComponent.PERSISTENCE_ALWAYS)
@TopComponent.Registration(mode = "output", openAtStartup = false)
@ActionID(category = "Window", id = "blue.ui.core.script.javascript.JavaScriptConsoleTopComponent")
@ActionReference(path = "Menu/Window", position = 1905)
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_JavaScriptConsoleAction",
        preferredID = "JavaScriptConsoleTopComponent")
@Messages({
    "CTL_JavaScriptConsoleAction=JavaScript Console",
    "CTL_JavaScriptConsoleTopComponent=JavaScript Console",
    "HINT_JavaScriptConsoleTopComponent=REPL for evaluating JavaScript code"
})
public final class JavaScriptConsoleTopComponent extends TopComponent {

    private static final String PROMPT = "js> ";

    private final JConsole jconsole = new JConsole();

    private boolean listenersRegistered;

    private final JavaScriptProxyListener proxyListener = () -> jconsole.setText(PROMPT);

    private final java.beans.PropertyChangeListener projectListener =
            (PropertyChangeEvent evt) -> {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    SwingUtilities.invokeLater(() -> appendProjectMarker(
                            (BlueProject) evt.getNewValue()));
                }
            };

    public JavaScriptConsoleTopComponent() {
        initComponents();
        setName("JavaScript Console");
        setToolTipText("REPL for evaluating JavaScript code");

        this.add(new JScrollPane(jconsole), BorderLayout.CENTER);

        registerListeners();

        jconsole.setDelegate(new JConsoleDelegate() {
            @Override
            public String getPrompt() {
                return PROMPT;
            }

            @Override
            public void processCommands(String commands, Reader stdin,
                    Writer stdout, Writer stderr) {
                try {
                    Object result = JavaScriptProxy.processScript(commands, stdin,
                            stdout, stderr);

                    if (result != null) {
                        String resultText = result.toString();

                        if (!resultText.isEmpty()) {
                            stdout.write(resultText);
                            if (!resultText.endsWith(System.lineSeparator())) {
                                stdout.write(System.lineSeparator());
                            }
                        }
                    }
                } catch (IOException | ScriptException ex) {
                    Exceptions.printStackTrace(ex);
                }
            }
        });
    }

    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        setLayout(new java.awt.BorderLayout());
    }// </editor-fold>//GEN-END:initComponents

    @Override
    public void componentOpened() {
        registerListeners();
    }

    @Override
    public void componentClosed() {
        unregisterListeners();
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        p.getProperty("version");
    }

    private void appendProjectMarker(BlueProject project) {
        StringBuilder text = new StringBuilder(jconsole.getText());

        if (!text.isEmpty() && !text.toString().endsWith(System.lineSeparator())) {
            text.append(System.lineSeparator());
        }

        text.append("// project: ")
                .append(getProjectLabel(project))
                .append(System.lineSeparator())
                .append(PROMPT);

        jconsole.setText(text.toString());
    }

    private String getProjectLabel(BlueProject project) {
        if (project == null) {
            return "No Project";
        }

        if (project.getDataFile() == null) {
            return "New Project";
        }

        return project.getDataFile().getName();
    }

    private void registerListeners() {
        if (listenersRegistered) {
            return;
        }

        JavaScriptProxy.addJavaScriptProxyListener(proxyListener);
        BlueProjectManager.getInstance().addPropertyChangeListener(projectListener);
        listenersRegistered = true;
    }

    private void unregisterListeners() {
        if (!listenersRegistered) {
            return;
        }

        JavaScriptProxy.removeJavaScriptProxyListener(proxyListener);
        BlueProjectManager.getInstance().removePropertyChangeListener(projectListener);
        listenersRegistered = false;
    }
}