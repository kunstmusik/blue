package blue.ui.core.script.jython.console;

import java.awt.GridLayout;
import javax.swing.JFrame;

/**
 * Code used from http://www.javaprogrammingforums.com/java-swing-tutorials/4907-java-tip-jul-29-2010-swing-console-component.html
 * 
 * @author Andrew
 */

public class JConsoleTest
{
	public static void main(String[] args)
	{
		JFrame frame = new JFrame("Jython Interactive Console");
		frame.setSize(640, 480);
		frame.setLayout(new GridLayout());
		frame.add(new JConsole());
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);
	}
}
