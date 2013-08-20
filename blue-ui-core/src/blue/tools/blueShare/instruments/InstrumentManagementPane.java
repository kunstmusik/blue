package blue.tools.blueShare.instruments;

import blue.BlueSystem;
import blue.tools.blueShare.BlueShareRemoteCaller;
import blue.tools.blueShare.NamePasswordPanel;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.IOException;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import org.apache.xmlrpc.XmlRpcException;

public class InstrumentManagementPane extends JComponent {

    NamePasswordPanel namePasswordPanel = new NamePasswordPanel();

    CardLayout cardLayout = new CardLayout();

    JTable instrumentTable = new JTable();

    InstrumentManagementTableModel iTableModel = new InstrumentManagementTableModel();

    JButton fetchInstrumentsButton = new JButton(BlueSystem
            .getString("blueShare.fetch"));

    JButton removeInstrumentButton = new JButton(BlueSystem
            .getString("blueShare.remove"));

    JButton updateInstrumentButton = new JButton(BlueSystem
            .getString("blueShare.update"));

    JPanel cardPanel;

    public InstrumentManagementPane() {
        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        this.add(namePasswordPanel, BorderLayout.NORTH);

        instrumentTable.setModel(iTableModel);

        // JSplitPane mainSplit = new JSplitPane();

        cardPanel = new JPanel(cardLayout);

        JScrollPane jsp = new JScrollPane();
        jsp.setViewportView(instrumentTable);

        cardPanel.add(new JLabel(BlueSystem
                .getString("blueShare.noInstrumentsForUser")), "none");
        cardPanel.add(jsp, "instruments");

        this.add(cardPanel, BorderLayout.CENTER);

        // mainSplit.add(jsp, JSplitPane.LEFT);
        // mainSplit.add(jsp, JSplitPane.RIGHT);

        // this.add(mainSplit, BorderLayout.CENTER);

        fetchInstrumentsButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                fetchInstruments();
            }
        });

        removeInstrumentButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                removeInstrument();
            }
        });

        /*
         * updateInstrumentButton.addActionListener(new ActionListener() {
         * public void actionPerformed(ActionEvent e) { updateInstrument(); }
         * });
         */

        JPanel buttonPanel = new JPanel();
        buttonPanel.add(fetchInstrumentsButton);
        buttonPanel.add(removeInstrumentButton);
        // buttonPanel.add(updateInstrumentButton);

        this.add(buttonPanel, BorderLayout.SOUTH);

        cardLayout.show(cardPanel, "instruments");
    }

    protected void removeInstrument() {
        InstrumentOption iOption = iTableModel
                .getInstrumentOption(instrumentTable.getSelectedRow());

        if (iOption == null) {
            return;
        }

        int retVal = JOptionPane.showConfirmDialog(null, BlueSystem
                .getString("blueShare.removeConfirm"));
        if (retVal != JOptionPane.YES_OPTION) {
            return;
        }

        String username = namePasswordPanel.getUsername();
        String password = namePasswordPanel.getPassword();

        try {
            boolean success = BlueShareRemoteCaller.removeInstrument(username,
                    password, iOption.getInstrumentId());
        } catch (XmlRpcException | IOException xre) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            return;
        }
        JOptionPane.showMessageDialog(null,
                "Instrument was successfully removed.", "Success",
                JOptionPane.PLAIN_MESSAGE);

        fetchInstruments();
    }

    protected void updateInstrument() {
        InstrumentOption iOption = iTableModel
                .getInstrumentOption(instrumentTable.getSelectedRow());

        if (iOption == null) {
            return;
        }

        JOptionPane.showMessageDialog(null,
                "Diagram and figure out best implementation");

        /*
         * int retVal = JOptionPane.showConfirmDialog(null, "Are you sure you
         * would like to remove this instrument?"); if(retVal !=
         * JOptionPane.YES_OPTION) { return; }
         * 
         * String username = namePasswordPanel.getUsername(); String password =
         * namePasswordPanel.getPassword();
         * 
         * try { boolean success = BlueShareRemoteCaller.removeInstrument(
         * username, password, iOption.getInstrumentId()); } catch
         * (XmlRpcException xre) { String error =
         * BlueSystem.getString("message.errorLabel") + " " +
         * xre.getLocalizedMessage(); JOptionPane.showMessageDialog( null,
         * error, BlueSystem.getString("message.error"),
         * JOptionPane.ERROR_MESSAGE); iTableModel.setInstrumentOptions(null);
         * return; } catch (IOException ioe) { String error =
         * BlueSystem.getString("message.errorLabel") + " " +
         * ioe.getLocalizedMessage(); JOptionPane.showMessageDialog( null,
         * error, BlueSystem.getString("message.error"),
         * JOptionPane.ERROR_MESSAGE); iTableModel.setInstrumentOptions(null);
         * return; } JOptionPane.showMessageDialog( null, "Instrument was
         * successfully removed.", "Success", JOptionPane.PLAIN_MESSAGE);
         * 
         * fetchInstruments();
         */
    }

    protected void fetchInstruments() {
        String username = namePasswordPanel.getUsername();
        String password = namePasswordPanel.getPassword();

        try {
            InstrumentOption[] iOptions = BlueShareRemoteCaller
                    .getInstrumentOptionsForUser(username, password);
            iTableModel.setInstrumentOptions(iOptions);

            if (iOptions.length == 0) {
                cardLayout.show(cardPanel, "none");
            } else {
                cardLayout.show(cardPanel, "instruments");
            }

        } catch (ParseException pe) {
            String error = BlueSystem
                    .getString("blueShare.selectServer.couldNotReadResponse");
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            return;
        } catch (XmlRpcException xre) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            return;
        } catch (IOException ioe) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            return;
        }
    }

    public static void main(String[] args) {
        blue.utility.GUI.showComponentAsStandalone(
                new InstrumentManagementPane(), "InstrumentManagementPane",
                true);
    }
}