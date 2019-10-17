package blue.tools.blueShare;

/**
 * <p>Title: blue</p>
 * <p>Description: an object composition environment for csound</p>
 * <p>Copyright: Copyright (c) 2001-2002</p>
 * <p>Company: steven yi music</p>
 * @author unascribed
 * @version 1.0
 */

import java.io.IOException;
import java.util.Vector;
import org.apache.xmlrpc.XmlRpcClient;
import org.apache.xmlrpc.XmlRpcException;

public class BlueShareTest {

    public BlueShareTest() {
    }

    public static void main(String[] args) {
        try {
            // XmlRpcClient xrpc = new
            // XmlRpcClient("http://localhost/blueShare/blueShareServer.php");
            XmlRpcClient xrpc = new XmlRpcClient(
                    "http://www.kunstmusik.com/blueShare/blueShareServer.php");
            Vector v = new Vector();
            v.addElement(new Integer(1));
            String result = (String) xrpc.execute(
                    "blueShare.getInstrumentList", v);
            System.out.println("result: " + result);
        } catch (XmlRpcException | IOException e) {
            System.err.println("error...");
        }
    }
}