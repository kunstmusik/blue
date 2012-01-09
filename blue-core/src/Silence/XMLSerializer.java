package Silence;

import java.io.*;
import java.lang.reflect.*;
import java.util.*;

/**
 * Relieves programmers of all need to write code for loading or saving objects,
 * except for importing or exporting files from externally specified formats.
 * Does what Java serialization does, but uses an easily-readable text format
 * that is similar to well-formed XML. This class is designed to be harder to
 * break and easier to maintain than the Java serialization mechanism, but it
 * may not be as efficient, and it produces somewhat bulky files.
 * <p>
 * It is too much to expect that a high-level, general-purpose mechanism such as
 * this will automatically work in all cases. However, if the author of a new
 * class takes care to declare problematic objects transient and to provide
 * default constructors for inner classes, things should go well.
 * <p>
 * Like Java serialization:
 * <nl>
 * <li>Static fields are not represented.
 * <li>Transient fields are not represented.
 * <li>Compound objects are represented recursively using a depth-first
 * traversal of the object graph.
 * <li>Multiple references to single objects are represented.
 * <li>Multi-dimensional arrays are represented as arrays of arrays.
 * </nl>
 * <p>
 * Unlike Java serialization:
 * <nl>
 * <li>There is no explicit versioning mechanism.
 * <li>Fields of a object present in the input stream, but not present in the
 * class of the object, will be discarded without throwing an exception. If the
 * class of the object cannot be loaded, a ClassNotFoundException will be
 * thrown. If this is detected, elements representing objects of the offending
 * class can be removed from the XML file using a text editor.
 * <li>Fields of an object present in the class of the object, but not present
 * in the input stream, should be initialized to an acceptable value in the
 * default constructor of the class.
 * <li>Superclass names are not represented, but their fields are represented
 * along with the fields of their subclasses, if any.
 * <li>Non-element fields of arrays, Collections, and Maps are not represented;
 * but the fields of their subclasses, if any, are represented.
 * <li>Only those inner classes with constructors taking only one argument (the
 * enclosing object's "this") are represented.
 * </nl>
 * 
 * @author Copyright (C) 2000 by Michael Gogins. All rights reserved. <ADDRESS>
 *         gogins@pipeline.com </ADDRESS>
 * 
 * Modified by Steven Yi to fail gracefully if unable to find fields to restore
 */
public class XMLSerializer {

    /**
     * Unit tests.
     */
    public static void main(String args[]) {
        try {
            Double d = new Double(1.0);
            XMLSerializer xmlSerializer = new XMLSerializer();
            PrintWriter printWriter = new PrintWriter(new FileWriter(
                    "c:/test.xml"));
            xmlSerializer.write(printWriter, d, null);
            printWriter.close();
            BufferedReader bufferedReader = new BufferedReader(new FileReader(
                    "c:/test.xml"));
            xmlSerializer.clear();
            Double deserialized = (Double) xmlSerializer.read(bufferedReader,
                    null);
            printWriter = new PrintWriter(new FileWriter("c:/test.1.xml"));
            xmlSerializer.clear();
            xmlSerializer.write(printWriter, deserialized, null);
            printWriter.close();
        } catch (Exception x) {
            x.printStackTrace();
        }
    }

    /**
     * The number of bytes to read ahead for start tags in input streams.
     */
    public static final int READ_AHEAD_LIMIT = 0x200;

    /**
     * Java breaks its own rules: Vector and TreeMap (at least) return one
     * answer for "==" and another answer for "Object.equals()". This class can
     * be used to derive a true identity hash code, because it uses the "=="
     * operator as a reliable test of identity.
     */
    public class ObjectsForHashCodes extends TreeMap {
        Hashtable listsForJavaHashCodes = new Hashtable();

        public ObjectsForHashCodes() {
        }

        /**
         * Clears all elements.
         */
        public void clear() {
            listsForJavaHashCodes.clear();
            super.clear();
        }

        /**
         * Adds an object and its hash code.
         */
        public void add(Object object) {
            getHashCode(object);
        }

        /**
         * Returns true if the object is in the collection, which should mean
         * that it has already been written or read.
         */
        public boolean containsObject(Object object) {
            int javaHash = object.hashCode();
            String javaHashCode = String.valueOf(javaHash);
            if (listsForJavaHashCodes.containsKey(javaHashCode))

            {
                ArrayList list = (ArrayList) listsForJavaHashCodes
                        .get(javaHashCode);
                int i = 0;
                for (int n = list.size(); i < n; i++) {
                    if (list.get(i) == object) {
                        return true;
                    }
                }
            }
            return false;
        }

        /**
         * Returns the hash code for the object. Not to be confused with
         * java.lang.Object.hashCode(), which can return identical values for
         * different objects.
         */
        public String getHashCode(Object object) {
            int javaHash = object.hashCode();
            String javaHashCode = String.valueOf(javaHash);
            if (listsForJavaHashCodes.containsKey(javaHashCode)) {
                ArrayList list = (ArrayList) listsForJavaHashCodes
                        .get(javaHashCode);
                int i = 0;
                for (int n = list.size(); i < n; i++) {
                    if (list.get(i) == object) {
                        return javaHashCode + "-" + String.valueOf(i);
                    }
                }
                String hashCode = javaHashCode + "-" + String.valueOf(i);
                list.add(object);
                put(hashCode, object);
            } else {
                ArrayList list = new ArrayList();
                list.add(object);
                listsForJavaHashCodes.put(javaHashCode, list);
                put(javaHashCode, object);
            }
            return javaHashCode;
        }
    }

    /**
     * Maintains a map between objects and their References hash codes.
     */
    public ObjectsForHashCodes references = new ObjectsForHashCodes();

    /**
     * Names of the elementary data types of the Java language, for reference
     * while scanning input streams.
     */
    public static TreeSet namesOfPrimitiveTypes = null;

    /**
     * Stores maps of storable fields for Classes.
     */
    public TreeMap storableFieldsCache = new TreeMap();

    /**
     * Stores Classes of arrays and collections whose non-element fields are not
     * to be represented.
     */
    public static HashSet collectionBaseClasses = null;

    /**
     * Stores Classes of wrappers for primitive types, which have no default
     * constructors.
     */
    public static HashSet wrapperClasses = null;
    static {
        wrapperClasses = new HashSet();
        wrapperClasses.add(Boolean.class);
        wrapperClasses.add(Byte.class);
        wrapperClasses.add(Character.class);
        wrapperClasses.add(Integer.class);
        wrapperClasses.add(Float.class);
        wrapperClasses.add(Double.class);
        namesOfPrimitiveTypes = new TreeSet();
        namesOfPrimitiveTypes.add("boolean");
        namesOfPrimitiveTypes.add("byte");
        namesOfPrimitiveTypes.add("char");
        namesOfPrimitiveTypes.add("short");
        namesOfPrimitiveTypes.add("int");
        namesOfPrimitiveTypes.add("long");
        namesOfPrimitiveTypes.add("float");
        namesOfPrimitiveTypes.add("double");
        collectionBaseClasses = new HashSet();
        collectionBaseClasses.add((new boolean[0]).getClass());
        collectionBaseClasses.add((new byte[0]).getClass());
        collectionBaseClasses.add((new char[0]).getClass());
        collectionBaseClasses.add((new short[0]).getClass());
        collectionBaseClasses.add((new int[0]).getClass());
        collectionBaseClasses.add((new long[0]).getClass());
        collectionBaseClasses.add((new float[0]).getClass());
        collectionBaseClasses.add((new double[0]).getClass());
        collectionBaseClasses.add((new Object[0]).getClass());
        collectionBaseClasses.add(String.class);
        collectionBaseClasses.add(Collection.class);
        collectionBaseClasses.add(AbstractCollection.class);
        collectionBaseClasses.add(AbstractSet.class);
        collectionBaseClasses.add(HashSet.class);
        collectionBaseClasses.add(TreeSet.class);
        collectionBaseClasses.add(AbstractList.class);
        collectionBaseClasses.add(AbstractSequentialList.class);
        collectionBaseClasses.add(LinkedList.class);
        collectionBaseClasses.add(ArrayList.class);
        collectionBaseClasses.add(Vector.class);
        collectionBaseClasses.add(Stack.class);
        collectionBaseClasses.add(AbstractMap.class);
        collectionBaseClasses.add(HashMap.class);
        collectionBaseClasses.add(TreeMap.class);
        collectionBaseClasses.add(Hashtable.class);
        collectionBaseClasses.add(WeakHashMap.class);
        collectionBaseClasses.add(Properties.class);
    }

    public XMLSerializer() {
    }

    /**
     * Removes all elements from the map of hash codes to object references, and
     * from the cache of storable fields.
     */
    protected void clear() {
        references.clear();
        storableFieldsCache.clear();
    }

    /**
     * Writes an object and its state, and all of the object's elements and
     * members and their state, recursively, to an output stream of simplified
     * XML text using the PrintWriter. Although the XML in the output stream is
     * well-formed, only XML that is written by XMLSerializer.write(PrintWriter
     * printWriter) should be expected to later be successfully read by
     * XMLSerializer.read(), since a newlines is written after each tag and each
     * value, and a space is written after each attribute value, to help the
     * parser.
     */
    public void write(PrintWriter printWriter, Object object)
            throws IOException, IllegalAccessException {
        write(printWriter, object, null);
    }

    /**
     * Reads an object and its state, except for transient and static members,
     * and all of that object's elements and members and their state,
     * recursively, from an input stream of simplified XML text using the
     * BufferedReader. Only XML that is written by
     * XMLSerializer.write(PrintWriter printWriter) should be expected to be
     * successfully read.
     */
    public Object read(BufferedReader bufferedReader) throws IOException,
            ClassNotFoundException, IllegalAccessException,
            InstantiationException, InvocationTargetException {
        return read(bufferedReader, null);
    }

    /**
     * Implements XMLSerializer.read(BufferedReader bufferedReader).
     */

    protected Object read(BufferedReader bufferedReader, Object enclosingObject)
            throws IOException, ClassNotFoundException, IllegalAccessException,
            InstantiationException, InvocationTargetException {
        String startTag = null;
        try {
            startTag = bufferedReader.readLine();

            // Debugging.
            // System.out.println(startTag);
            String objectToReadClassName = getName(startTag);
            if (namesOfPrimitiveTypes.contains(objectToReadClassName)) {
                return readPrimitive(bufferedReader);
            }
            Class objectToReadClass = Class.forName(objectToReadClassName);
            String objectToReadHashCode = getHashCode(startTag);
            if (references.containsKey(objectToReadHashCode)) {
                return readReference(objectToReadHashCode);
            } else if (objectToReadClass == String.class) {
                Object objectToRead = readString(bufferedReader);
                references.put(objectToReadHashCode, objectToRead);
                return objectToRead;
            } else if (objectToReadClass == Boolean.class) {
                bufferedReader.readLine();
                Object objectToRead = Boolean
                        .valueOf(bufferedReader.readLine());
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass == Byte.class) {
                bufferedReader.readLine();
                Object objectToRead = new Byte(bufferedReader.readLine());
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass == Character.class) {
                bufferedReader.readLine();
                Object objectToRead = new Character(bufferedReader.readLine()
                        .charAt(0));
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass == Integer.class) {
                bufferedReader.readLine();
                Object objectToRead = new Integer(bufferedReader.readLine());
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass == Float.class) {
                bufferedReader.readLine();
                Object objectToRead = new Float(bufferedReader.readLine());
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass == Double.class) {
                bufferedReader.readLine();
                Object objectToRead = new Double(bufferedReader.readLine());
                references.put(objectToReadHashCode, objectToRead);
                bufferedReader.readLine();
                bufferedReader.readLine();
                return objectToRead;
            } else if (objectToReadClass.isArray()) {
                int objectToReadElementCount = getCount(startTag);
                Object objectToRead = Array.newInstance(objectToReadClass
                        .getComponentType(), objectToReadElementCount);
                references.put(objectToReadHashCode, objectToRead);
                return readArray(bufferedReader, objectToRead,
                        objectToReadElementCount);
            } else {
                Object objectToRead = null;
                if (objectToReadClassName.indexOf("$") == -1) {
                    objectToRead = objectToReadClass.newInstance();
                    references.put(objectToReadHashCode, objectToRead);
                } else {
                    // Inner class constructors take the enclosing object as a
                    // parameter.
                    Constructor constructor = objectToReadClass
                            .getConstructors()[0];
                    Object[] initArgs = new Object[1];
                    initArgs[0] = enclosingObject;
                    objectToRead = constructor.newInstance(initArgs);
                }

                if (objectToRead instanceof Collection) {
                    return readCollection(bufferedReader,
                            (Collection) objectToRead);
                } else if (objectToRead instanceof Map) {
                    return readMap(bufferedReader, (Map) objectToRead);
                } else {
                    return readStorableFields(bufferedReader, objectToRead);
                }
            }
        } catch (IOException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        } catch (ClassNotFoundException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        } catch (IllegalAccessException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        } catch (InstantiationException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        } catch (InvocationTargetException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        } catch (StringIndexOutOfBoundsException x) {
            x.printStackTrace();
            System.out.println("Exception reading tag: " + startTag);
            throw x;
        }
    }

    /**
     * Reads a primitive value from the stream as a String.
     */
    protected String readPrimitive(BufferedReader bufferedReader)
            throws IOException {
        String value = bufferedReader.readLine();

        // Debugging.
        // System.out.println(value);
        String endTag = bufferedReader.readLine();

        // Debugging.
        // System.out.println(endTag);
        return value;
    }

    /**
     * "Reads" a reference from the stream by returning a cached object.
     */
    protected Object readReference(String objectToReadHashCode) {
        return references.get(objectToReadHashCode);
    }

    /**
     * Reads a string into the object.
     */
    protected Object readString(BufferedReader bufferedReader)
            throws IOException {
        StringBuffer stringBuffer = new StringBuffer();
        Object objectToRead = null;
        for (;;) {
            String line = bufferedReader.readLine();

            // Debugging.
            // System.out.println(line);
            if (line.startsWith("</")) {
                break;
            }
            stringBuffer.append(line);
            stringBuffer.append("\n");
        }
        stringBuffer.setLength(stringBuffer.length() - 1);
        return stringBuffer.toString();
    }

    /**
     * Reads all storable fields of the object.
     */
    protected Object readStorableFields(BufferedReader bufferedReader,
            Object objectToRead) throws IOException, IllegalAccessException,
            InstantiationException, ClassNotFoundException,
            InvocationTargetException {
        Map fields = getStorableFields(objectToRead);
        String line = null;
        try {
            for (;;) {
                bufferedReader.mark(READ_AHEAD_LIMIT);
                line = bufferedReader.readLine();

                // Debugging.
                // System.out.println(line);
                if (line.startsWith("</")) {
                    return objectToRead;
                }

                String fieldName = getID(line);
                Field field = (Field) fields.get(fieldName);
                if (field == null) {
                    System.out.println("Warning - field '" + fieldName
                            + "' not found for:  " + line);

                    // Consume lines until the end tag is found?
                    if (line.indexOf("<" + getName(line)) != -1) {
                        String missingFieldEndTag = "</" + getName(line);
                        for (;;) {
                            String consumedLine = bufferedReader.readLine();
                            if (consumedLine.indexOf(missingFieldEndTag) != -1) {
                                break;
                            }
                        }
                    }
                } else {
                    if (isReference(line)) {
                        bufferedReader.reset();
                        Object fieldValue = read(bufferedReader, objectToRead);
                        field.set(objectToRead, fieldValue);
                    }

                    else {
                        Class fieldType = field.getType();
                        if (fieldType.isPrimitive()) {
                            String fieldValue = bufferedReader.readLine();

                            // Debugging.
                            // System.out.println(fieldValue);
                            if (fieldType == Boolean.TYPE) {
                                field.set(objectToRead, Boolean
                                        .valueOf(fieldValue));
                            } else if (fieldType == Byte.TYPE) {
                                field.set(objectToRead, Byte
                                        .valueOf(fieldValue));
                            } else if (fieldType == Character.TYPE) {
                                field.set(objectToRead, new Character(
                                        fieldValue.charAt(0)));
                            } else if (fieldType == Short.TYPE) {
                                field.set(objectToRead, Short
                                        .valueOf(fieldValue));
                            } else if (fieldType == Integer.TYPE) {
                                field.set(objectToRead, Integer
                                        .valueOf(fieldValue));
                            } else if (fieldType == Float.TYPE) {
                                field.set(objectToRead, Float
                                        .valueOf(fieldValue));
                            } else if (fieldType == Double.TYPE) {
                                field.set(objectToRead, Double
                                        .valueOf(fieldValue));
                            }
                            String endTag = bufferedReader.readLine();

                            // Debugging.
                            // System.out.println(endTag);
                        } else {
                            bufferedReader.reset();
                            Object fieldValue = read(bufferedReader,
                                    objectToRead);

                            try {
                                field.set(objectToRead, fieldValue);
                            } catch (Exception e) {
                                System.err
                                        .println("Error - Unable to set value for object");
                                System.out.println(field + " : " + objectToRead
                                        + " : " + fieldValue);
                                // e.printStackTrace();
                            }
                        }
                    }
                }
            }
        } catch (IOException x) {
            System.out.println("Exception in reading storable fields: " + line
                    + ".");
            throw x;
        } catch (IllegalAccessException x) {
            System.out.println("Exception in reading storable fields: " + line
                    + ".");
            throw x;
        } catch (InstantiationException x) {
            System.out.println("Exception in reading storable fields: " + line
                    + ".");
            throw x;
        } catch (ClassNotFoundException x) {
            System.out.println("Exception in reading storable fields: " + line
                    + ".");
            throw x;
        }
    }

    /**
     * Recursively implements write(PrintWriter printWriter, Object object,
     * String fieldName)
     */
    protected void write(PrintWriter printWriter, Object objectToWrite,
            String objectToWriteFieldName) throws IOException,
            IllegalAccessException {
        if (objectToWrite == null) {
            return;
        }
        Class objectToWriteClass = objectToWrite.getClass();
        if (!isStorable(objectToWriteClass)) {
            return;
        }
        String objectToWriteClassName = objectToWriteClass.getName();
        if (writeReference(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        if (writeString(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        if (writeArray(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        if (writeCollection(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        if (writeMap(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        if (writeObject(printWriter, objectToWrite, objectToWriteClass,
                objectToWriteClassName, objectToWriteFieldName)) {
            return;
        }
        throw new IOException("Failed to write object.");
    }

    /**
     * Writes an object as a reference to an already serialized object.
     */
    protected boolean writeReference(PrintWriter printWriter,
            Object objectToWrite, Class objectToWriteClass,
            String objectToWriteClassName, String objectToWriteFieldName) {
        if (references.containsObject(objectToWrite)) {
            printWriter.print("<");
            printWriter.print(objectToWriteClassName);
            printWriter.print(" hash=");
            printWriter.print(references.getHashCode(objectToWrite));
            if (objectToWriteFieldName != null) {
                printWriter.print(" id=");
                printWriter.print(objectToWriteFieldName);
            }
            printWriter.println(" />");
            return true;
        } else {
            references.add(objectToWrite);
            return false;
        }
    }

    /**
     * Writes a Java String.
     */
    protected boolean writeString(PrintWriter printWriter,
            Object objectToWrite, Class objectToWriteClass,
            String objectToWriteClassName, String objectToWriteFieldName)
            throws IOException, IllegalAccessException {
        if (objectToWrite instanceof String) {
            writeStartTag(printWriter, objectToWriteClassName, references
                    .getHashCode(objectToWrite), objectToWriteFieldName);
            if (objectToWrite != null) {
                printWriter.println((String) objectToWrite);
            }
            writeEndTag(printWriter, objectToWriteClassName);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Writes a start tag in the format:
     * 
     * <pre>
     *                                    &lt;FullyQualifiedClassName hash={identityHashCode}[ id={fieldName}] &gt;\n.
     * </pre>
     */
    protected void writeStartTag(PrintWriter printWriter,
            String objectToWriteClassName, String objectToWriteHashCode,
            String objectToWriteFieldName) {
        printWriter.print("<");
        printWriter.print(objectToWriteClassName);
        printWriter.print(" hash=");
        printWriter.print(objectToWriteHashCode);
        if (objectToWriteFieldName != null) {
            printWriter.print(" id=");
            printWriter.print(objectToWriteFieldName);
        }
        printWriter.println(" >");
    }

    /**
     * Writes all storable fields of an object. If a field is an elementary
     * type, or is a String, it is written as a String. Otherwise, it is written
     * as an object, that is, recursively.
     */
    protected void writeStorableFields(PrintWriter printWriter,
            Object objectToWrite) throws IOException, IllegalAccessException {
        Map storableFields = getStorableFields(objectToWrite);
        Iterator iterator = storableFields.keySet().iterator();
        while (iterator.hasNext()) {
            Field fieldToWrite = (Field) storableFields.get(iterator.next());
            Object fieldToWriteObject = fieldToWrite.get(objectToWrite);
            Class fieldToWriteClass = fieldToWrite.getType();
            String fieldToWriteClassName = fieldToWriteClass.getName();
            String fieldToWriteFieldName = fieldToWrite.getName();
            if (fieldToWriteClass.isPrimitive()) {
                printWriter.print("<");
                printWriter.print(fieldToWriteClassName);
                printWriter.print(" id=");
                printWriter.print(fieldToWriteFieldName);
                printWriter.println(" >");
                if (fieldToWriteObject != null) {
                    printWriter.println(String.valueOf(fieldToWriteObject));
                }
                writeEndTag(printWriter, fieldToWriteClassName);
            } else {
                write(printWriter, fieldToWriteObject, fieldToWriteFieldName);
            }
        }
    }

    /**
     * Writes a full end tag for the specified class name.
     */
    protected void writeEndTag(PrintWriter printWriter,
            String objectToWriteClassName) {
        printWriter.print("</");
        printWriter.print(objectToWriteClassName);
        printWriter.println(">");
    }

    /**
     * Writes an array as a start tag, followed by a sequence of elements,
     * followed by all other storable fields, followed by an end tag.
     */
    protected boolean writeArray(PrintWriter printWriter, Object objectToWrite,
            Class objectToWriteClass, String objectToWriteClassName,
            String objectToWriteFieldName) throws IOException,
            IllegalAccessException {
        if (objectToWriteClass.isArray()) {
            printWriter.print("<");
            printWriter.print(objectToWriteClassName);
            printWriter.print(" hash=");
            printWriter.print(references.getHashCode(objectToWrite));

            if (objectToWriteFieldName != null) {
                printWriter.print(" id=");
                printWriter.print(objectToWriteFieldName);
            }

            printWriter.print(" N=");
            int n = Array.getLength(objectToWrite);
            printWriter.print(String.valueOf(n));
            printWriter.println(" >");

            for (int i = 0; i < n; i++) {
                Object arrayElement = Array.get(objectToWrite, i);
                if (objectToWriteClass.getComponentType().isPrimitive()) {
                    if (arrayElement != null) {
                        printWriter.println(String.valueOf(arrayElement));
                    }
                } else {
                    write(printWriter, arrayElement, null);
                }
            }
            writeStorableFields(printWriter, objectToWrite);
            writeEndTag(printWriter, objectToWriteClassName);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Writes a Collection as a start tag, followed by a sequence of elements,
     * followed by a sequence of all storable, non-Collection fields, followed
     * by an end tag.
     */
    protected boolean writeCollection(PrintWriter printWriter,
            Object objectToWrite, Class objectToWriteClass,
            String objectToWriteClassName, String objectToWriteFieldName)
            throws IOException, IllegalAccessException {
        if (objectToWrite instanceof java.util.Collection) {
            writeStartTag(printWriter, objectToWriteClassName, references
                    .getHashCode(objectToWrite), objectToWriteFieldName);
            Collection collection = (Collection) objectToWrite;
            if (!collection.isEmpty()) {
                printWriter.println("<[>");
                Iterator iterator = collection.iterator();
                while (iterator.hasNext()) {
                    Object element = iterator.next();
                    write(printWriter, element, null);
                }
                printWriter.println("</[>");
            }
            writeStorableFields(printWriter, objectToWrite);
            writeEndTag(printWriter, objectToWriteClassName);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Writes a Map as a start tag, followed by sequence of elements in key0,
     * value0, key1, value1 order, followed by a sequence of all storable,
     * non-Collection fields, followed by an end tag.
     */
    protected boolean writeMap(PrintWriter printWriter, Object objectToWrite,
            Class objectToWriteClass, String objectToWriteClassName,
            String objectToWriteFieldName) throws IOException,
            IllegalAccessException {
        if (objectToWrite instanceof java.util.Map) {
            writeStartTag(printWriter, objectToWriteClassName, references
                    .getHashCode(objectToWrite), objectToWriteFieldName);
            Map map = (Map) objectToWrite;
            if (!map.isEmpty()) {
                printWriter.println("<[>");
                Iterator iterator = map.keySet().iterator();
                while (iterator.hasNext()) {
                    Object key = iterator.next();
                    write(printWriter, key, null);
                    Object value = map.get(key);
                    write(printWriter, value, null);
                }
                printWriter.println("</[>");
            }
            writeStorableFields(printWriter, objectToWrite);
            writeEndTag(printWriter, objectToWriteClassName);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Writes an object that is not a String, an array, a Collection, or a Map
     * as a start tag, followed by a sequence of storable fields, followed by an
     * end tag.
     */
    protected boolean writeObject(PrintWriter printWriter,
            Object objectToWrite, Class objectToWriteClass,
            String objectToWriteClassName, String objectToWriteFieldName)
            throws IOException, IllegalAccessException {
        if (!(objectToWrite instanceof String || objectToWriteClass.isArray()
                || objectToWrite instanceof Collection || objectToWrite instanceof Map)) {
            writeStartTag(printWriter, objectToWriteClassName, references
                    .getHashCode(objectToWrite), objectToWriteFieldName);
            writeStorableFields(printWriter, objectToWrite);
            writeEndTag(printWriter, objectToWriteClassName);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Reads all the elements of an array from the BufferedReader as simplified
     * XML text.
     */
    protected Object readArray(BufferedReader bufferedReader,
            Object arrayToRead, int n) throws IOException,
            InstantiationException, IllegalAccessException,
            ClassNotFoundException, InvocationTargetException {
        Class arrayToReadClass = arrayToRead.getClass();
        Class type = arrayToReadClass.getComponentType();
        if (type.isPrimitive()) {
            for (int i = 0; i < n; i++) {
                String element = bufferedReader.readLine();

                // Debugging.
                // System.out.println(element);
                if (type == Boolean.TYPE) {
                    Array.setBoolean(arrayToRead, i, Boolean.valueOf(element)
                            .booleanValue());
                } else if (type == Byte.TYPE) {
                    Array.setByte(arrayToRead, i, Byte.valueOf(element)
                            .byteValue());
                } else if (type == Character.TYPE) {
                    Array.setChar(arrayToRead, i, element.charAt(0));
                } else if (type == Short.TYPE) {
                    Array.setShort(arrayToRead, i, Short.valueOf(element)
                            .shortValue());
                } else if (type == Integer.TYPE) {
                    Array.setInt(arrayToRead, i, Integer.valueOf(element)
                            .intValue());
                } else if (type == Float.TYPE) {
                    Array.setFloat(arrayToRead, i, Float.valueOf(element)
                            .floatValue());
                } else if (type == Double.TYPE) {
                    Array.setDouble(arrayToRead, i, Double.valueOf(element)
                            .doubleValue());
                }
            }
        } else {
            for (int i = 0; i < n; i++) {
                Object element = read(bufferedReader);
                Array.set(arrayToRead, i, element);
            }
        }
        return readStorableFields(bufferedReader, arrayToRead);
    }

    /**
     * Reads all the elements of a Collection from the BufferedReader as
     * simplified XML text.
     */
    protected Object readCollection(BufferedReader bufferedReader,
            Collection collectionToRead) throws IOException,
            InstantiationException, IllegalAccessException,
            ClassNotFoundException, InvocationTargetException {
        bufferedReader.mark(READ_AHEAD_LIMIT);
        String startTag = bufferedReader.readLine();

        // Debugging.
        // System.out.println(startTag);
        if (startTag.equals("<[>")) {
            for (;;) {
                Object element = read(bufferedReader);
                if (element == null) {
                    throw new IOException("No element for Collection.");
                }
                collectionToRead.add(element);
                bufferedReader.mark(READ_AHEAD_LIMIT);
                String endTag = bufferedReader.readLine();

                // Debugging.
                // System.out.println(endTag);
                if (endTag.equals("</[>")) {
                    break;
                }
                bufferedReader.reset();
            }
        } else {
            bufferedReader.reset();
        }
        return readStorableFields(bufferedReader, collectionToRead);
    }

    /**
     * Reads all the elements of a Map from the BufferedReader as simplified XML
     * text.
     */
    protected Object readMap(BufferedReader bufferedReader, Map mapToRead)
            throws IOException, InstantiationException, IllegalAccessException,
            ClassNotFoundException, InvocationTargetException {
        bufferedReader.mark(READ_AHEAD_LIMIT);
        String startTag = bufferedReader.readLine();

        // Debugging.
        // System.out.println(startTag);
        if (startTag.equals("<[>")) {
            for (;;) {
                Object key = read(bufferedReader);

                if (key == null) {
                    throw new IOException("No key for Map.");
                }

                Object value = read(bufferedReader);

                if (value == null) {
                    throw new IOException("No value for Map.");
                }

                mapToRead.put(key, value);
                bufferedReader.mark(READ_AHEAD_LIMIT);
                String endTag = bufferedReader.readLine();

                // Debugging.
                // System.out.println(endTag);
                if (endTag.equals("</[>")) {
                    break;
                }
                bufferedReader.reset();
            }
        } else {
            bufferedReader.reset();
        }
        return readStorableFields(bufferedReader, mapToRead);
    }

    /**
     * Returns whether or not the object is storable (not transient and not
     * static).
     */
    public boolean isStorable(Class clazz) {
        int modifiers = clazz.getModifiers();
        if (Modifier.isTransient(modifiers)) {
            return false;
        } else if (Modifier.isStatic(modifiers)) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Returns whether or not the field is storable (not transient and not
     * static).
     */
    protected boolean isStorable(Field field) {
        int modifiers = field.getModifiers();
        if (Modifier.isTransient(modifiers)) {
            return false;
        } else if (Modifier.isStatic(modifiers)) {
            return false;
        } else if (Modifier.isFinal(modifiers)) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Returns whether the tag represents a reference to an already represented
     * object.
     */
    protected boolean isReference(String tag) {
        return tag.indexOf(" />") != -1;
    }

    /**
     * Returns the class name represented in a start tag.
     */
    protected String getName(String startTag) {
        int endIndex = startTag.indexOf(" ", 1);
        return startTag.substring(1, endIndex);
    }

    /**
     * Returns the hash code represented in a start tag.
     */
    protected String getHashCode(String startTag) {
        int beginIndex = startTag.indexOf(" hash=");
        if (beginIndex == -1) {
            return null;
        }
        beginIndex = beginIndex + 6;
        int endIndex = startTag.indexOf(" ", beginIndex);
        return startTag.substring(beginIndex, endIndex);
    }

    /**
     * Returns the field name represented in a start tag.
     */
    protected String getID(String startTag) {
        int beginIndex = startTag.indexOf(" id=");

        if (beginIndex == -1) {
            return null;
        }

        beginIndex = beginIndex + 4;
        int endIndex = startTag.indexOf(" ", beginIndex);

        if (endIndex == -1) {
            return null;
        }

        return startTag.substring(beginIndex, endIndex);
    }

    /**
     * Returns the count of array elements represented in a start tag.
     */
    protected int getCount(String startTag) {
        int beginIndex = startTag.indexOf(" N=");

        if (beginIndex == -1) {
            return 0;
        }

        beginIndex = beginIndex + 3;
        int endIndex = startTag.indexOf(" ", beginIndex);

        if (endIndex == -1) {
            return 0;
        }

        return Integer.valueOf(startTag.substring(beginIndex, endIndex))
                .intValue();
    }

    /**
     * Throws an exception if the start tag does not match the end tag; useful
     * for debugging.
     */
    protected void testMatch(String startTag, String endTag) throws IOException {
        String startName = getName(startTag);
        String endName = getName(endTag);

        if (!startName.equals(endName)) {
            throw new IOException("Start (" + startTag + ") and end (" + endTag
                    + ") tags do not match.");
        }
    }

    /**
     * Returns all storable declared fields of the specified object and all its
     * superclasses, keyed by name. However, Collections, Strings, and Maps are
     * stored only as sequences of elements; the non-element fields of those
     * classes are not represented, although the fields of their subclasses, if
     * any, are represented.
     */
    protected Map getStorableFields(Object object) {
        Class clazz = object.getClass();
        String className = clazz.getName();
        Map storableFields = (Map) storableFieldsCache.get(className);

        if (storableFields != null) {
            return storableFields;
        }

        storableFields = new TreeMap();
        storableFieldsCache.put(className, storableFields);

        // Debugging.
        // System.out.print("Stored fields for: ");
        // System.out.println(className);
        while (clazz != null) {
            if (collectionBaseClasses.contains(clazz)) {
                break;
            }

            // Debugging.
            // className = clazz.getName();
            // System.err.println("Class: " + className);
            Field[] fields = clazz.getDeclaredFields();
            for (int i = 0; i < fields.length; i++) {
                Field field = fields[i];
                if (isStorable(field)) {
                    field.setAccessible(true);
                    storableFields.put(field.getName(), field);
                }
            }
            clazz = clazz.getSuperclass();
        }
        return storableFields;
    }
}
