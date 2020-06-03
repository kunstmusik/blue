package blue.ui.utilities.jconsole;

/** Code used from http://www.javaprogrammingforums.com/java-swing-tutorials/4907-java-tip-jul-29-2010-swing-console-component.html
 * 
 */

public class CommandHistory
{
	private class Node
	{
		public String	command;
		public Node		next;
		public Node		prev;

		public Node(String command)
		{
			this.command = command;
			next = null;
			prev = null;
		}
	}

	private int		length;
	/**
	 * The top command with an empty string
	 */
	private Node	top;
	private Node	current;
	private int		capacity;

	/**
	 * Creates a CommandHistory with the default capacity of 64
	 */
	public CommandHistory()
	{
		this(64);
	}

	/**
	 * Creates a CommandHistory with a specified capacity
	 * 
	 * @param capacity
	 */
	public CommandHistory(int capacity)
	{
		top = new Node("");
		current = top;
		top.next = top;
		top.prev = top;
		length = 1;
		this.capacity = capacity;
	}

	/**
	 * @return
	 */
	public String getPrevCommand()
	{
		current = current.prev;
		return current.command;
	}

	/**
	 * @return
	 */
	public String getNextCommand()
	{
		current = current.next;
		return current.command;
	}

	/**
	 * Adds a command to this command history manager. Resets the command
	 * counter for which command to select next/prev.<br>
	 * If the number of remembered commands exceeds the capacity, the oldest
	 * item is removed.<br>
	 * Duplicate checking only for most recent item.
	 * 
	 * @param command
	 */
	public void add(String command)
	{
		// move back to the top
		current = top;
		// see if we even need to insert
		if (top.prev.command.equals(command))
		{
			// don't insert
			return;
		}
		// insert before top.next
		Node temp = new Node(command);
		Node oldPrev = top.prev;
		temp.prev = oldPrev;
		oldPrev.next = temp;
		temp.next = top;
		top.prev = temp;
		length++;
		if (length > capacity)
		{
			// delete oldest command
			Node newNext = top.next.next;
			top.next = newNext;
			newNext.prev = top;
		}
	}

	/**
	 * @return the capacity
	 */
	public int getCapacity()
	{
		return capacity;
	}

	/**
	 * @return the length
	 */
	public int getLength()
	{
		return length;
	}
}
