<?xml version='1.0' ?>

<xsl:stylesheet  
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

<xsl:import href="xhtml/chunk.xsl"/>

<!-- <xsl:param name="html.stylesheet" select="'blue.css'"/> -->
<xsl:param name="chunk.section.depth" select="2" />
<xsl:param name="chunk.first.sections" select="1" />
<xsl:param name="use.id.as.filename" select="1" />
<xsl:param name="chunker.output.indent" select="'yes'" />
<xsl:param name="generate.section.toc.level" select="2" />
<xsl:param name="ignore.image.scaling" select="1" />
<!-- <xsl:param name="section.autolabel" select="1" /> -->
<!--<xsl:param name="section.label.includes.component.label" select="1" /> -->
<!-- <xsl:param name="navig.graphics" select="1" /> -->

<xsl:param name="generate.toc">
appendix  toc,title
article/appendix  nop
article   toc,title
book      toc,title <!--,figure,table,example,equation -->
chapter   toc,title
part      toc,title
preface   toc,title
qandadiv  toc
qandaset  toc
reference toc,title
sect1     toc
sect2     toc
sect3     toc
sect4     toc
sect5     toc
section   toc
set       toc,title
</xsl:param>

</xsl:stylesheet>
