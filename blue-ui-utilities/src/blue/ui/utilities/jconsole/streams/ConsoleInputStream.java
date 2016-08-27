package blue.ui.utilities.jconsole.streams;

import blue.ui.utilities.jconsole.JConsole;
import java.io.IOException;
import java.io.Reader;

/**
 * Data written into this is data from the console
 * 
 * Code used from http://www.javaprogrammingforums.com/java-swing-tutorials/4907-java-tip-jul-29-2010-swing-console-component.html
 * 
 * @author Andrew
 */
public class ConsoleInputStream extends Reader
{
	private JConsole		console;
	private StringBuilder	stream;

	/**
	 * @param console
	 */
	public ConsoleInputStream(JConsole console)
	{
		this.console = console;
		stream = new StringBuilder();
	}

	/**
	 * @param text
	 */
	public void addText(String text)
	{
		synchronized (stream)
		{
			stream.append(text);
		}
	}

	@Override
	public synchronized void close() throws IOException
	{
		console = null;
		stream = null;
	}

	@Override
	public int read(char[] buf, int off, int len) throws IOException
	{
		int count = 0;
		boolean doneReading = false;
		for (int i = off; i < off + len && !doneReading; i++)
		{
			// determine if we have a character we can read
			// we need the lock for stream
			int length = 0;
			while (length == 0)
			{
				// sleep this thread until there is something to read
				try
				{
					Thread.sleep(100);
				}
				catch (InterruptedException e)
				{
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
				synchronized (stream)
				{
					length = stream.length();
				}
			}
			synchronized (stream)
			{
				// get the character
				buf[i] = stream.charAt(0);
				// delete it from the buffer
				stream.deleteCharAt(0);
				count++;
				if (buf[i] == '\n')
				{
					doneReading = true;
				}
			}
		}
		return count;
	}
}
