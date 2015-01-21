package blue.ui.core.script.jython.console;

import blue.BlueSystem;
import blue.scripting.PythonProxy;
import blue.scripting.PythonProxyListener;
import blue.ui.core.script.jython.console.streams.ConsoleInputStream;
import blue.ui.core.script.jython.console.streams.ConsoleOutputStream;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.Reader;
import java.io.Writer;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JPopupMenu;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.text.AbstractDocument;
import javax.swing.text.AttributeSet;
import javax.swing.text.BadLocationException;
import javax.swing.text.DocumentFilter;
import org.python.core.PyException;
import org.python.util.InteractiveInterpreter;

/**
 * Code used from http://www.javaprogrammingforums.com/java-swing-tutorials/4907-java-tip-jul-29-2010-swing-console-component.html
 * 
 * Original Author: Android
 * Updated by Steven Yi for blue
 * 
 * @author steven yi
 */
public class JConsole extends JTextArea implements KeyListener
{
	/**
	 * 
	 */
	private static final long	serialVersionUID	= -5866169869353990380L;
	/**
	 * The input stream that will pass data to the script engine
	 */
	public final Reader			in;
	/**
	 * The output stream from the script engine
	 */
	public final Writer			out;
	/**
	 * The error stream from the script engine
	 */
	public final Writer			err;
	private CommandHistory		history;
	/**
	 * index of where we can start editing text
	 */
	int							editStart;
	/**
	 * True when a script is running
	 */
	boolean						running;
	/**
	 * The script engine and scope we're using
	 */
	InteractiveInterpreter		engine;
	/**
	 * The allowed variables and stuff to use
	 */
	// private Bindings bindings;
	// ScriptContext context;
	private ConsoleFilter		filter;
	private Thread				pythonThread;

    JPopupMenu menu = new JPopupMenu();
    
	/**
	 * 
	 */
	public JConsole()
	{
		// create streams that will link with this
		in = new ConsoleInputStream(this);
		// System.setIn(in);
		out = new ConsoleOutputStream(this);
		// System.setOut(new PrintStream(out));
		err = new ConsoleOutputStream(this);
		// setup the command history
		history = new CommandHistory();
		// setup the script engine
		engine = PythonProxy.getInterpreter();
		engine.setIn(in);
		engine.setOut(out);
		engine.setErr(err);
		setTabSize(4);
		// setup the event handlers and input processing
		// setup the document filter so output and old text can't be modified
		addKeyListener(this);
		filter = new ConsoleFilter(this);
		((AbstractDocument) getDocument()).setDocumentFilter(filter);
		// start text and edit location
		setText("Jython Interactive Console\r\n>>> ");
		// editStart = getText().length();
		getCaret().setDot(editStart);
        
        PythonProxy.addPythonProxyListener(new PythonProxyListener() {

            @Override
            public void pythonProxyReinitializePerformed() {
                if(engine != null) {
                    engine.setIn(System.in);
                    engine.setOut(System.out);
                    engine.setErr(System.err);
                }
                engine = PythonProxy.getInterpreter();
                engine.setIn(in);
                engine.setOut(out);
                engine.setErr(err);
            }
        });
        
        Action clearAction = new AbstractAction("Clear" ) {

            @Override
            public void actionPerformed(ActionEvent e) {
                setText(">>>");
            }
            
        };
        clearAction.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                KeyEvent.VK_L, BlueSystem.getMenuShortcutKey()));
        
        menu.add(clearAction);
        
        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                if(SwingUtilities.isRightMouseButton(e)) {
                    menu.show(e.getComponent(), e.getX(), e.getY());
                }
            }
            
        });
	}

	@Override
	public void setText(String text)
	{
		setText(text, true);
	}

	/**
	 * @param text
	 * @param updateEditStart
	 */
	public void setText(String text, boolean updateEditStart)
	{
		filter.useFilters = false;
		super.setText(text);
		filter.useFilters = true;
		if (updateEditStart)
		{
			editStart = text.length();
		}
		getCaret().setDot(text.length());
	}

	private class ConsoleFilter extends DocumentFilter
	{
		private JConsole	console;
		public boolean		useFilters;

		public ConsoleFilter(JConsole console)
		{
			this.console = console;
			useFilters = true;
		}

		@Override
		public void insertString(DocumentFilter.FilterBypass fb, int offset, String string, AttributeSet attr)
				throws BadLocationException
		{
			if (useFilters)
			{
				// determine if we can insert
				if (console.getSelectionStart() >= console.editStart)
				{
					// can insert
					fb.insertString(offset, string, attr);
				}
				else
				{
					// insert at the end of the document
					fb.insertString(console.getText().length(), string, attr);
					// move cursor to the end
					console.getCaret().setDot(console.getText().length());
					// console.setSelectionEnd(console.getText().length());
					// console.setSelectionStart(console.getText().length());
				}
			}
			else
			{
				fb.insertString(offset, string, attr);
			}
		}

		@Override
		public void replace(DocumentFilter.FilterBypass fb, int offset, int length, String text, AttributeSet attrs)
				throws BadLocationException
		{
			if (useFilters)
			{
				// determine if we can replace
				if (console.getSelectionStart() >= console.editStart)
				{
					// can replace
					fb.replace(offset, length, text, attrs);
				}
				else
				{
					// insert at end
					fb.insertString(console.getText().length(), text, attrs);
					// move cursor to the end
					console.getCaret().setDot(console.getText().length());
					// console.setSelectionEnd(console.getText().length());
					// console.setSelectionStart(console.getText().length());
				}
			}
			else
			{
				fb.replace(offset, length, text, attrs);
			}
		}

		@Override
		public void remove(DocumentFilter.FilterBypass fb, int offset, int length) throws BadLocationException
		{
			if (useFilters)
			{
				if (offset > console.editStart)
				{
					// can remove
					fb.remove(offset, length);
				}
				else
				{
					// only remove the portion that's editable
					fb.remove(console.editStart, length - (console.editStart - offset));
					// move selection to the start of the editable section
					console.getCaret().setDot(console.editStart);
					// console.setSelectionStart(console.editStart);
					// console.setSelectionEnd(console.editStart);
				}
			}
			else
			{
				fb.remove(offset, length);
			}
		}
	}

	@Override
	public void keyPressed(KeyEvent e)
	{
		if ((e.getModifiers() & BlueSystem.getMenuShortcutKey()) == BlueSystem.getMenuShortcutKey())
		{
            if(e.getKeyCode() == KeyEvent.VK_L  && !e.isShiftDown() && !e.isAltDown()) {
                this.setText(">>>");
                e.consume();
            } 
            else if (e.getKeyCode() == KeyEvent.VK_A && !e.isShiftDown() && !e.isAltDown())
			{
				// handle select all
				// if selection start is in the editable region, try to select
				// only editable text
				if (getSelectionStart() >= editStart)
				{
					// however, if we already have the editable region selected,
					// default select all
					if (getSelectionStart() != editStart || getSelectionEnd() != this.getText().length())
					{
						setSelectionStart(editStart);
						setSelectionEnd(this.getText().length());
						// already handled, don't use default handler
						e.consume();
					}
				}
			}
			else if (e.getKeyCode() == KeyEvent.VK_DOWN && !e.isShiftDown() && !e.isAltDown())
			{
				// next in history
				StringBuilder temp = new StringBuilder(getText());
				// remove the current command
				temp.delete(editStart, temp.length());
				temp.append(history.getNextCommand());
				setText(temp.toString(), false);
				e.consume();
			}
			else if (e.getKeyCode() == KeyEvent.VK_UP && !e.isShiftDown() && !e.isAltDown())
			{
				// prev in history
				StringBuilder temp = new StringBuilder(getText());
				// remove the current command
				temp.delete(editStart, temp.length());
				temp.append(history.getPrevCommand());
				setText(temp.toString(), false);
				e.consume();
			}
		}
		else if (e.getKeyCode() == KeyEvent.VK_ENTER)
		{
			// handle script execution
			if (!e.isShiftDown() && !e.isAltDown())
			{
				if (running)
				{
					// we need to put text into the input stream
					StringBuilder text = new StringBuilder(this.getText());
					text.append(System.getProperty("line.separator"));
					String command = text.substring(editStart);
					setText(text.toString());
					((ConsoleInputStream) in).addText(command);
				}
				else
				{
					// run the engine
					StringBuilder text = new StringBuilder(this.getText());
					String command = text.substring(editStart);
					text.append(System.getProperty("line.separator"));
					setText(text.toString());
					// add to the history
					history.add(command);
					// run on a separate thread
					pythonThread = new Thread(new PythonRunner(command));
					// so this thread can't hang JVM shutdown
					pythonThread.setDaemon(true);
					pythonThread.start();
				}
				e.consume();
			}
			else if (!e.isAltDown())
			{
				// shift+enter
				StringBuilder text = new StringBuilder(this.getText());
				if (getSelectedText() != null)
				{
					// replace text
					text.delete(getSelectionStart(), getSelectionEnd());
				}
				text.insert(getSelectionStart(), System.getProperty("line.separator"));
				setText(text.toString(), false);
			}
		}
		else if (e.getKeyCode() == KeyEvent.VK_HOME)
		{
			int selectStart = getSelectionStart();
			if (selectStart > editStart)
			{
				// we're after edit start, see if we're on the same line as edit
				// start
				for (int i = editStart; i < selectStart; i++)
				{
					if (this.getText().charAt(i) == '\n')
					{
						// not on the same line
						// use default handle
						return;
					}
				}
				if (e.isShiftDown())
				{
					// move to edit start
					getCaret().moveDot(editStart);
				}
				else
				{
					// move select end, too
					getCaret().setDot(editStart);
				}
				e.consume();
			}
		}
	}

	private class PythonRunner implements Runnable
	{
		private String	commands;

		public PythonRunner(String commands)
		{
			this.commands = commands;
		}

		@Override
		public void run()
		{
			running = true;
			try
			{
				engine.runsource(commands);
			}
			catch (PyException e)
			{
				// prints out the python error message to the console
				e.printStackTrace();
			}
			// engine.eval(commands, context);
			StringBuilder text = new StringBuilder(getText());
			text.append(">>> ");
			setText(text.toString());
			running = false;
		}
	}

	@SuppressWarnings("deprecation")
	@Override
	public void finalize()
	{
		if (running)
		{
			// I know it's depracated, but since this object is being destroyed,
			// this thread should go, too
			pythonThread.stop();
			pythonThread.destroy();
		}
	}

	@Override
	public void keyReleased(KeyEvent e)
	{
		// don't need to use this for anything
	}

	@Override
	public void keyTyped(KeyEvent e)
	{
		// don't need to use this for anything
	}
}
